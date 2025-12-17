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
  getAllSystems,
  getAllPricingVariables,
  getCosts,
  getAllLaborers,
  getAllChipBlends,
  getAllJobs,
  getAllChipInventory,
  getTopCoatInventory,
  getBaseCoatInventory,
  getMiscInventory,
} from './db';

// Sync state stored in IndexedDB
const SYNC_STATE_KEY = 'sync_state';
const BATCH_SIZE = 50; // Process records in batches

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
 * Push local data to Supabase
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

    // Define tables to sync in order (respecting dependencies)
    const tablesToSync = [
      { store: 'systems', getter: getAllSystems },
      { store: 'pricingVariables', getter: getAllPricingVariables },
      { store: 'costs', getter: async () => [await getCosts()].filter(Boolean) },
      { store: 'laborers', getter: getAllLaborers },
      { store: 'chipBlends', getter: getAllChipBlends },
      { store: 'chipInventory', getter: getAllChipInventory },
      { store: 'topCoatInventory', getter: async () => [await getTopCoatInventory()].filter(Boolean) },
      { store: 'baseCoatInventory', getter: async () => [await getBaseCoatInventory()].filter(Boolean) },
      { store: 'miscInventory', getter: async () => [await getMiscInventory()].filter(Boolean) },
      { store: 'jobs', getter: getAllJobs },
    ];

    for (const { store, getter } of tablesToSync) {
      try {
        const records = await getter();
        if (!records || records.length === 0) continue;

        const tableName = getSupabaseTableName(store);

        // Convert to snake_case and add user_id
        const recordsToSync = records.map((record: any) => {
          const converted = objectToSnakeCase(record);
          // Remove any fields that don't belong (like old chip_size)
          const { chip_size, ...cleanRecord } = converted;
          return {
            ...cleanRecord,
            user_id: user.id,
            synced_at: new Date().toISOString(),
          };
        });

        // Batch insert/upsert
        const batches = batchArray(recordsToSync, BATCH_SIZE);

        for (const batch of batches) {
          const { error } = await supabase
            .from(tableName)
            .upsert(batch, {
              onConflict: 'id',
              ignoreDuplicates: false,
            });

          if (error) {
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
      'laborers',
      'chip_blends',
      'chip_inventory',
      'topcoat_inventory',
      'basecoat_inventory',
      'misc_inventory',
      'jobs',
    ];

    const db = await openDB();

    for (const tableName of tablesToSync) {
      try {
        // Build query
        let query = supabase
          .from(tableName)
          .select('*')
          .eq('user_id', user.id);

        // If we have a last sync time, only pull updated records
        if (lastSync) {
          query = query.gt('updated_at', lastSync);
        }

        const { data, error } = await query;

        if (error) {
          errors.push(`${tableName}: ${error.message}`);
          continue;
        }

        if (!data || data.length === 0) continue;

        // Get corresponding IndexedDB store name using helper
        const storeName = getIndexedDBStoreName(tableName);

        // Convert to camelCase
        const recordsToStore = data.map((record: any) => {
          const { user_id, synced_at, ...rest } = record;
          return objectToCamelCase(rest);
        });

        // Store records in IndexedDB using proper Promise wrappers for native IndexedDB
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
                  // Conflict resolution: last-write-wins
                  const { winner, source } = resolveConflict(existing, record);

                  if (source === 'remote') {
                    const putRequest = store.put(winner);
                    putRequest.onerror = () => reject(putRequest.error);
                    putRequest.onsuccess = () => resolve({ wasConflict: true });
                  } else {
                    // If local wins, don't overwrite
                    resolve({ wasConflict: false });
                  }
                } else {
                  // New record from remote
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

/**
 * Full bidirectional sync
 */
export async function syncWithSupabase(): Promise<SyncResult> {
  const startTime = new Date().toISOString();

  try {
    // First, pull remote changes
    const pullResult = await pullFromSupabase();

    // Then, push local changes
    const pushResult = await pushToSupabase();

    // Update last sync timestamp
    await setLastSyncTimestamp(startTime);

    const allErrors = [...pullResult.errors, ...pushResult.errors];

    return {
      success: allErrors.length === 0,
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
  // Check if any records have been modified since last sync
  // This would check each table for records where updatedAt > syncedAt
  return false; // TODO: Implement
}
