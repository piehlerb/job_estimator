/**
 * Sync Engine
 * Handles bidirectional synchronization between IndexedDB and Supabase
 */

import { supabase } from './supabase';
import { getCurrentUser } from './auth';
import {
  objectToSnakeCase,
  objectToCamelCase,
  resolveConflict,
  getSupabaseTableName,
  getIndexedDBStoreName,
  batchArray,
} from './syncHelpers';
import type { SyncResult } from '../types';
import {
  openDB,
  getAllSystemsForSync,
  getAllPricingVariablesForSync,
  getCosts,
  getPricing,
  getAllLaborersForSync,
  getAllCustomersForSync,
  getAllLeadsForSync,
  getAllLeadAppointmentsForSync,
  getAllProductsForSync,
  getAllBaseCoatColorsForSync,
  getAllChipBlendsForSync,
  getAllJobsForSync,
  getAllChipInventoryForSync,
  getAllTintInventoryForSync,
  getAllShoppingItemsForSync,
  getAllCommTemplatesForSync,
  getAllReferralAssociatesForSync,
  getAllReferralServicesForSync,
  getJobsByIds,
  getTopCoatInventory,
  getBaseCoatInventory,
  getMiscInventory,
} from './db';
import {
  buildJobWorkingSetOrFilter,
  getJobWorkingSetCutoff,
} from './jobSyncPolicy';
import {
  getSyncQueue,
  clearSyncQueue,
  hasPendingChanges as checkPendingChanges,
} from './syncQueue';

// Sync state stored in IndexedDB
const SYNC_STATE_KEY = 'sync_state';
const BATCH_SIZE = 50; // Process records in batches
const SELECT_PAGE_SIZE = 500; // Supabase/PostgREST page size for reads

// Current organization context — set by AuthContext when user logs in.
// When set, push attaches org_id to records and pull filters by org_id.
let _currentOrgId: string | null = null;

export function setSyncOrgContext(orgId: string | null): void {
  _currentOrgId = orgId;
}

export function getSyncOrgContext(): string | null {
  return _currentOrgId;
}

function getScopedTableQuery(tableName: string, userId: string): any {
  return _currentOrgId
    ? supabase.from(tableName).select('*').eq('org_id', _currentOrgId)
    : supabase.from(tableName).select('*').eq('user_id', userId).is('org_id', null);
}

async function fetchPagedRows(buildQuery: () => any): Promise<{ data: any[]; error: any | null }> {
  const rows: any[] = [];
  let from = 0;

  while (true) {
    const to = from + SELECT_PAGE_SIZE - 1;
    const { data, error } = await buildQuery().range(from, to);

    if (error) {
      return { data: rows, error };
    }

    const page = data || [];
    rows.push(...page);

    if (page.length < SELECT_PAGE_SIZE) {
      return { data: rows, error: null };
    }

    from += SELECT_PAGE_SIZE;
  }
}

async function storeRemoteRecords(
  db: IDBDatabase,
  tableName: string,
  data: any[]
): Promise<{ recordsPulled: number; conflicts: number; errors: string[] }> {
  const errors: string[] = [];
  let recordsPulled = 0;
  let conflicts = 0;

  if (!data || data.length === 0) {
    return { recordsPulled, conflicts, errors };
  }

  const storeName = getIndexedDBStoreName(tableName);
  const recordsToStore = data.map((record: any) => {
    const { user_id, synced_at, ...rest } = record;
    return objectToCamelCase(rest);
  });

  for (const record of recordsToStore) {
    try {
      const result = await new Promise<{ wasConflict: boolean }>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const getRequest = store.get(record.id);

        getRequest.onerror = () => reject(getRequest.error);
        getRequest.onsuccess = () => {
          const existing = getRequest.result;

          if (existing) {
            const { winner, source } = resolveConflict(existing, record);

            if (source === 'remote') {
              const putRequest = store.put(winner);
              putRequest.onerror = () => reject(putRequest.error);
              putRequest.onsuccess = () => resolve({ wasConflict: true });
            } else {
              resolve({ wasConflict: false });
            }
          } else {
            const putRequest = store.put(record);
            putRequest.onerror = () => reject(putRequest.error);
            putRequest.onsuccess = () => resolve({ wasConflict: false });
          }
        };

        tx.onerror = () => reject(tx.error);
      });

      if (result.wasConflict) {
        conflicts++;
      }
      recordsPulled++;
    } catch (error: any) {
      errors.push(`${storeName}[${record.id}]: ${error.message}`);
    }
  }

  return { recordsPulled, conflicts, errors };
}

/**
 * Get last sync timestamp from IndexedDB
 */
async function getLastSyncTimestamp(): Promise<string | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('metadata', 'readonly');
      const store = tx.objectStore('metadata');
      const request = store.get(SYNC_STATE_KEY);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result?.lastSync || null);
    });
  } catch (error) {
    console.error('Error getting last sync timestamp:', error);
    return null;
  }
}

/**
 * Clear last sync timestamp (forces a full pull on next sync)
 */
export async function clearLastSyncTimestamp(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('metadata', 'readwrite');
      const store = tx.objectStore('metadata');
      const request = store.delete(SYNC_STATE_KEY);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error('Error clearing last sync timestamp:', error);
  }
}

/**
 * Save last sync timestamp to IndexedDB
 */
async function setLastSyncTimestamp(timestamp: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('metadata', 'readwrite');
      const store = tx.objectStore('metadata');
      const request = store.put({
        id: SYNC_STATE_KEY,
        lastSync: timestamp,
        updatedAt: new Date().toISOString(),
      });

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error('Error setting last sync timestamp:', error);
  }
}

/**
 * Push local data to Supabase (incremental - only changed records)
 */
export async function pushToSupabase(): Promise<{
  recordsPushed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let recordsPushed = 0;

  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Get pending changes from queue
    const pendingChanges = await getSyncQueue();

    if (pendingChanges.length === 0) {
      console.log('[Sync] No pending changes to push');
      return { recordsPushed: 0, errors: [] };
    }

    console.log(`[Sync] Pushing ${pendingChanges.length} pending change(s)`);

    // Group changes by store
    const changesByStore = new Map<string, Set<string>>();
    for (const change of pendingChanges) {
      if (!changesByStore.has(change.storeName)) {
        changesByStore.set(change.storeName, new Set());
      }
      changesByStore.get(change.storeName)!.add(change.recordId);
    }

    // Define getters for each store
    const storeGetters: Record<string, () => Promise<any[]>> = {
      systems: getAllSystemsForSync,
      pricingVariables: getAllPricingVariablesForSync,
      costs: async () => [await getCosts()].filter(Boolean),
      pricing: async () => [await getPricing()].filter(Boolean),
      laborers: getAllLaborersForSync,
      customers: getAllCustomersForSync,
      leads: getAllLeadsForSync,
      leadAppointments: getAllLeadAppointmentsForSync,
      products: getAllProductsForSync,
      baseCoatColors: getAllBaseCoatColorsForSync,
      chipBlends: getAllChipBlendsForSync,
      chipInventory: getAllChipInventoryForSync,
      tintInventory: getAllTintInventoryForSync,
      shoppingItems: getAllShoppingItemsForSync,
      commTemplates: getAllCommTemplatesForSync,
      referralAssociates: getAllReferralAssociatesForSync,
      referralServices: getAllReferralServicesForSync,
      topCoatInventory: async () => [await getTopCoatInventory()].filter(Boolean),
      baseCoatInventory: async () => [await getBaseCoatInventory()].filter(Boolean),
      miscInventory: async () => [await getMiscInventory()].filter(Boolean),
      jobs: getAllJobsForSync,
    };

    // Process each store with pending changes
    for (const [storeName, recordIds] of changesByStore.entries()) {
      try {
        const getter = storeGetters[storeName];
        if (!getter) {
          console.warn(`[Sync] No getter found for store: ${storeName}`);
          continue;
        }

        // Jobs are the growing table; read queued IDs directly instead of scanning
        // the entire local store. Other stores are small enough to keep the
        // existing broad getter pattern.
        const changedRecords = storeName === 'jobs'
          ? await getJobsByIds(Array.from(recordIds))
          : (await getter()).filter((record: any) => recordIds.has(record.id));

        if (changedRecords.length === 0) {
          console.log(`[Sync] No changed records found for ${storeName}`);
          continue;
        }

        const tableName = getSupabaseTableName(storeName);
        console.log(
          `[Sync] Pushing ${changedRecords.length} changed record(s) to ${tableName}`
        );

        // Convert to snake_case and add user_id + org_id
        const recordsToSync = changedRecords.map((record: any) => {
          const converted = objectToSnakeCase(record);
          // Remove any fields that don't belong (like old chip_size)
          const { chip_size, ...cleanRecord } = converted;
          return {
            ...cleanRecord,
            user_id: user.id,
            org_id: _currentOrgId,
            synced_at: new Date().toISOString(),
            // Preserve deleted flag if present
            deleted: record.deleted || false,
          };
        });

        // Batch insert/upsert
        const batches = batchArray(recordsToSync, BATCH_SIZE);

        for (const batch of batches) {
          const { error } = await supabase.from(tableName).upsert(batch, {
            onConflict: 'id',
            ignoreDuplicates: false,
          });

          if (error) {
            console.error(`[Sync] Error syncing ${storeName}:`, error);
            console.error(`[Sync] Failed batch data:`, batch);
            errors.push(
              `${storeName}: ${error.message} - ${error.details || ''} - ${
                error.hint || ''
              }`
            );
          } else {
            console.log(
              `[Sync] Successfully synced ${batch.length} record(s) to ${tableName}`
            );
            recordsPushed += batch.length;
          }
        }
      } catch (error: any) {
        errors.push(`${storeName}: ${error.message}`);
      }
    }

    // Clear the sync queue after successful push
    if (errors.length === 0) {
      await clearSyncQueue();
      console.log('[Sync] Cleared sync queue after successful push');
    }

    return { recordsPushed, errors };
  } catch (error: any) {
    errors.push(`Push failed: ${error.message}`);
    return { recordsPushed: 0, errors };
  }
}

/**
 * Push ALL data to Supabase (full sync - use for initial sync or force sync)
 * @param bumpTimestamps - When true, sets updated_at to now on every record so other
 *   devices will pull them even if their lastSync is newer than the original timestamps.
 *   Use only for one-time repairs (e.g. backfilling org_id).
 */
export async function pushAllToSupabase(options?: { bumpTimestamps?: boolean }): Promise<{
  recordsPushed: number;
  errors: string[];
}> {
  const bumpTimestamps = options?.bumpTimestamps ?? false;
  const errors: string[] = [];
  let recordsPushed = 0;

  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    console.log('[Sync] Performing FULL push of all data');

    // Define tables to sync in order (respecting dependencies)
    const tablesToSync = [
      { store: 'systems', getter: getAllSystemsForSync },
      { store: 'pricingVariables', getter: getAllPricingVariablesForSync },
      { store: 'costs', getter: async () => [await getCosts()].filter(Boolean) },
      { store: 'pricing', getter: async () => [await getPricing()].filter(Boolean) },
      { store: 'customers', getter: getAllCustomersForSync },
      { store: 'leads', getter: getAllLeadsForSync },
      { store: 'leadAppointments', getter: getAllLeadAppointmentsForSync },
      { store: 'products', getter: getAllProductsForSync },
      { store: 'laborers', getter: getAllLaborersForSync },
      { store: 'baseCoatColors', getter: getAllBaseCoatColorsForSync },
      { store: 'chipBlends', getter: getAllChipBlendsForSync },
      { store: 'chipInventory', getter: getAllChipInventoryForSync },
      { store: 'tintInventory', getter: getAllTintInventoryForSync },
      { store: 'shoppingItems', getter: getAllShoppingItemsForSync },
      { store: 'commTemplates', getter: getAllCommTemplatesForSync },
      { store: 'referralServices', getter: getAllReferralServicesForSync },
      { store: 'referralAssociates', getter: getAllReferralAssociatesForSync },
      { store: 'topCoatInventory', getter: async () => [await getTopCoatInventory()].filter(Boolean) },
      { store: 'baseCoatInventory', getter: async () => [await getBaseCoatInventory()].filter(Boolean) },
      { store: 'miscInventory', getter: async () => [await getMiscInventory()].filter(Boolean) },
      { store: 'jobs', getter: getAllJobsForSync },
    ];

    for (const { store, getter } of tablesToSync) {
      try {
        const records = await getter();
        if (!records || records.length === 0) {
          console.log(`[Sync] No records to sync for ${store}`);
          continue;
        }

        const tableName = getSupabaseTableName(store);
        console.log(`[Sync] Syncing ${records.length} record(s) to ${tableName}`);

        // Convert to snake_case and add user_id + org_id
        const nowIso = new Date().toISOString();
        const recordsToSync = records.map((record: any) => {
          const converted = objectToSnakeCase(record);
          const { chip_size, ...cleanRecord } = converted;
          return {
            ...cleanRecord,
            user_id: user.id,
            org_id: _currentOrgId,
            // Optionally bump updated_at so other devices' lastSync filters pick up these records
            ...(bumpTimestamps ? { updated_at: nowIso } : {}),
            synced_at: nowIso,
            deleted: record.deleted || false,
          };
        });

        // Batch insert/upsert
        const batches = batchArray(recordsToSync, BATCH_SIZE);

        for (const batch of batches) {
          const { error } = await supabase.from(tableName).upsert(batch, {
            onConflict: 'id',
            ignoreDuplicates: false,
          });

          if (error) {
            console.error(`[Sync] Error syncing ${store}:`, error);
            errors.push(`${store}: ${error.message}`);
          } else {
            recordsPushed += batch.length;
          }
        }
      } catch (error: any) {
        errors.push(`${store}: ${error.message}`);
      }
    }

    return { recordsPushed, errors };
  } catch (error: any) {
    errors.push(`Push failed: ${error.message}`);
    return { recordsPushed: 0, errors };
  }
}

/**
 * Pull remote data from Supabase and update local IndexedDB
 */
export async function pullFromSupabase(): Promise<{
  recordsPulled: number;
  conflicts: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let recordsPulled = 0;
  let conflicts = 0;

  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const lastSync = await getLastSyncTimestamp();

    // Tables to sync (same order as push)
    const tablesToSync = [
      'systems',
      'pricing_variables',
      'costs',
      'pricing',
      'laborers',
      'customers',
      'leads',
      'lead_appointments',
      'products',
      'base_coat_colors',
      'chip_blends',
      'chip_inventory',
      'tint_inventory',
      'shopping_items',
      'comm_templates',
      'referral_services',
      'referral_associates',
      'topcoat_inventory',
      'basecoat_inventory',
      'misc_inventory',
      'jobs',
    ];

    const db = await openDB();

    for (const tableName of tablesToSync) {
      try {
        const { data, error } = await fetchPagedRows(() => {
          let query = getScopedTableQuery(tableName, user.id);

          // Incremental pulls always fetch every updated record, including old
          // jobs. First/full job pulls cache only the active and recent working
          // set; older inactive jobs are loaded explicitly when needed.
          if (lastSync) {
            query = query.gt('updated_at', lastSync);
          } else if (tableName === 'jobs') {
            query = query.or(buildJobWorkingSetOrFilter(getJobWorkingSetCutoff()));
          }

          return query.order('updated_at', { ascending: true }).order('id', { ascending: true });
        });

        if (error) {
          errors.push(`${tableName}: ${error.message}`);
          continue;
        }

        if (!data || data.length === 0) continue;

        const storeResult = await storeRemoteRecords(db, tableName, data);
        recordsPulled += storeResult.recordsPulled;
        conflicts += storeResult.conflicts;
        errors.push(...storeResult.errors);
      } catch (error: any) {
        errors.push(`${tableName}: ${error.message}`);
      }
    }

    return { recordsPulled, conflicts, errors };
  } catch (error: any) {
    errors.push(`Pull failed: ${error.message}`);
    return { recordsPulled: 0, conflicts: 0, errors };
  }
}

export interface HistoricalJobLoadResult {
  recordsPulled: number;
  conflicts: number;
  errors: string[];
  hasMore?: boolean;
  oldestInstallDate?: string;
}

export type JobHistoryDateField = 'install' | 'estimate' | 'created';

function getJobHistoryDateColumn(dateField: JobHistoryDateField): string {
  switch (dateField) {
    case 'estimate':
      return 'estimate_date';
    case 'created':
      return 'created_at';
    case 'install':
    default:
      return 'install_date';
  }
}

function getDateRangeValue(date: string, dateField: JobHistoryDateField, boundary: 'start' | 'end'): string {
  if (dateField !== 'created') return date;
  return boundary === 'start' ? `${date}T00:00:00.000Z` : `${date}T23:59:59.999Z`;
}

async function ensureAuthenticatedUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('User not authenticated');
  }
  return user;
}

export async function loadOlderJobsFromSupabase(options?: {
  beforeInstallDate?: string;
  limit?: number;
}): Promise<HistoricalJobLoadResult> {
  const errors: string[] = [];
  let recordsPulled = 0;
  let conflicts = 0;

  try {
    const user = await ensureAuthenticatedUser();
    const db = await openDB();
    const cutoff = options?.beforeInstallDate || getJobWorkingSetCutoff().date;
    const limit = Math.max(1, Math.min(options?.limit ?? 100, 500));

    const { data, error } = await getScopedTableQuery('jobs', user.id)
      .lt('install_date', cutoff)
      .order('install_date', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(limit + 1);

    if (error) {
      return { recordsPulled, conflicts, errors: [`jobs: ${error.message}`], hasMore: false };
    }

    const page = (data || []).slice(0, limit);
    const oldestInstallDate = page
      .map((job: any) => job.install_date)
      .filter(Boolean)
      .sort()[0];
    const storeResult = await storeRemoteRecords(db, 'jobs', page);

    recordsPulled += storeResult.recordsPulled;
    conflicts += storeResult.conflicts;
    errors.push(...storeResult.errors);

    return {
      recordsPulled,
      conflicts,
      errors,
      hasMore: (data || []).length > limit,
      oldestInstallDate,
    };
  } catch (error: any) {
    errors.push(`Historical jobs load failed: ${error.message}`);
    return { recordsPulled, conflicts, errors, hasMore: false };
  }
}

export async function loadJobsByDateRangeFromSupabase(options: {
  startDate: string;
  endDate: string;
  dateField?: JobHistoryDateField;
}): Promise<HistoricalJobLoadResult> {
  const errors: string[] = [];
  let recordsPulled = 0;
  let conflicts = 0;

  try {
    const user = await ensureAuthenticatedUser();
    const db = await openDB();
    const dateField = options.dateField || 'install';
    const column = getJobHistoryDateColumn(dateField);
    const startValue = getDateRangeValue(options.startDate, dateField, 'start');
    const endValue = getDateRangeValue(options.endDate, dateField, 'end');

    const { data, error } = await fetchPagedRows(() =>
      getScopedTableQuery('jobs', user.id)
        .gte(column, startValue)
        .lte(column, endValue)
        .order(column, { ascending: true })
        .order('updated_at', { ascending: true })
        .order('id', { ascending: true })
    );

    if (error) {
      return { recordsPulled, conflicts, errors: [`jobs: ${error.message}`] };
    }

    const storeResult = await storeRemoteRecords(db, 'jobs', data);
    recordsPulled += storeResult.recordsPulled;
    conflicts += storeResult.conflicts;
    errors.push(...storeResult.errors);

    return { recordsPulled, conflicts, errors };
  } catch (error: any) {
    errors.push(`Job date range load failed: ${error.message}`);
    return { recordsPulled, conflicts, errors };
  }
}

export async function loadAllHistoricalJobsFromSupabase(): Promise<HistoricalJobLoadResult> {
  const errors: string[] = [];
  let recordsPulled = 0;
  let conflicts = 0;

  try {
    const user = await ensureAuthenticatedUser();
    const db = await openDB();

    const { data, error } = await fetchPagedRows(() =>
      getScopedTableQuery('jobs', user.id)
        .order('updated_at', { ascending: true })
        .order('id', { ascending: true })
    );

    if (error) {
      return { recordsPulled, conflicts, errors: [`jobs: ${error.message}`] };
    }

    const storeResult = await storeRemoteRecords(db, 'jobs', data);
    recordsPulled += storeResult.recordsPulled;
    conflicts += storeResult.conflicts;
    errors.push(...storeResult.errors);

    return { recordsPulled, conflicts, errors };
  } catch (error: any) {
    errors.push(`Full job history load failed: ${error.message}`);
    return { recordsPulled, conflicts, errors };
  }
}

/**
 * Full bidirectional sync
 */
export async function syncWithSupabase(): Promise<SyncResult> {
  const startTime = new Date().toISOString();

  try {
    // Push local changes first — ensures user's saves aren't overwritten by a stale pull
    const pushResult = await pushToSupabase();

    // Then pull remote changes
    const pullResult = await pullFromSupabase();

    const allErrors = [...pullResult.errors, ...pushResult.errors];
    const success = allErrors.length === 0;

    if (success) {
      await setLastSyncTimestamp(startTime);
    } else {
      console.warn('[Sync] Not advancing sync cursor because sync completed with errors', allErrors);
    }

    return {
      success,
      recordsPushed: pushResult.recordsPushed,
      recordsPulled: pullResult.recordsPulled,
      conflicts: pullResult.conflicts,
      errors: allErrors,
      timestamp: startTime,
    };
  } catch (error: any) {
    return {
      success: false,
      recordsPushed: 0,
      recordsPulled: 0,
      conflicts: 0,
      errors: [error.message],
      timestamp: startTime,
    };
  }
}

/**
 * Sync specific table
 */
export async function syncTable(tableName: string): Promise<void> {
  // Implementation for syncing a single table
  // Can be used for granular sync operations
  console.log(`Syncing table: ${tableName}`);
}

/**
 * Check if sync is needed (has local changes not synced)
 */
export async function hasPendingChanges(): Promise<boolean> {
  return checkPendingChanges();
}

