/**
 * Cloud Backup Library
 * Saves full data snapshots to Supabase for recovery from sync issues.
 * Keeps the most recent MAX_BACKUPS per user; older entries are auto-pruned.
 */

import { supabase } from './supabase';
import { getCurrentUser } from './auth';
import { getSyncOrgContext } from './sync';
import { exportAllData } from './backup';
import type { ExportData } from '../types';

const MAX_BACKUPS = 30;

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export interface CloudBackupRecord {
  id: string;
  createdAt: string;
  recordCount: number;
  note?: string;
}

/**
 * Save a full snapshot of all local data to Supabase.
 * @param note - Optional label, e.g. 'auto' or 'manual'
 */
export async function saveCloudBackup(note?: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const orgId = getSyncOrgContext();
  const data = await exportAllData();

  // Count total records across all entity arrays
  const recordCount = [
    data.jobs ?? [],
    data.systems ?? [],
    data.laborers ?? [],
    data.customers ?? [],
    data.products ?? [],
    data.costs ? [data.costs] : [],
    data.chipBlends ?? [],
    data.chipInventory ?? [],
    data.tintInventory ?? [],
    data.baseCoatColors ?? [],
    data.topCoatInventory ? [data.topCoatInventory] : [],
    data.baseCoatInventory ? [data.baseCoatInventory] : [],
    data.miscInventory ? [data.miscInventory] : [],
  ].reduce((sum, arr) => sum + arr.length, 0);

  const { error } = await supabase.from('backups').insert({
    id: generateId(),
    user_id: user.id,
    org_id: orgId,
    data,
    record_count: recordCount,
    note: note ?? null,
  });

  if (error) throw new Error(`Cloud backup failed: ${error.message}`);

  // Prune old backups after inserting
  await pruneOldBackups(user.id, orgId);
}

/**
 * List all cloud backups for the current user, newest first.
 * Metadata only — no data payload.
 */
export async function listCloudBackups(): Promise<CloudBackupRecord[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const orgId = getSyncOrgContext();

  let query = supabase
    .from('backups')
    .select('id, created_at, record_count, note')
    .order('created_at', { ascending: false })
    .limit(MAX_BACKUPS);

  if (orgId) {
    query = query.eq('org_id', orgId);
  } else {
    query = query.eq('user_id', user.id).is('org_id', null);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list backups: ${error.message}`);

  return (data ?? []).map((row: any) => ({
    id: row.id,
    createdAt: row.created_at,
    recordCount: row.record_count,
    note: row.note ?? undefined,
  }));
}

/**
 * Fetch the full data payload for a specific backup, ready to pass to executeImport().
 */
export async function fetchCloudBackupData(backupId: string): Promise<ExportData> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('backups')
    .select('data')
    .eq('id', backupId)
    .single();

  if (error) throw new Error(`Failed to fetch backup: ${error.message}`);
  return data.data as ExportData;
}

/**
 * Delete a specific backup by ID.
 */
export async function deleteCloudBackup(backupId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('backups')
    .delete()
    .eq('id', backupId)
    .eq('user_id', user.id);

  if (error) throw new Error(`Failed to delete backup: ${error.message}`);
}

/**
 * Delete backups older than the newest MAX_BACKUPS.
 */
async function pruneOldBackups(userId: string, orgId: string | null): Promise<void> {
  let query = supabase
    .from('backups')
    .select('id')
    .order('created_at', { ascending: false })
    .offset(MAX_BACKUPS);

  if (orgId) {
    query = query.eq('org_id', orgId);
  } else {
    query = query.eq('user_id', userId).is('org_id', null);
  }

  const { data, error } = await query;
  if (error || !data || data.length === 0) return;

  const idsToDelete = data.map((row: any) => row.id);
  await supabase.from('backups').delete().in('id', idsToDelete);
}
