/**
 * Auto Sync Hook
 * Handles automatic synchronization with Supabase
 */

import { useEffect, useRef } from 'react';
import { syncWithSupabase, pushAllToSupabase, clearLastSyncTimestamp } from '../lib/sync';
import { useAuth } from '../contexts/AuthContext';
import { useSyncStatus } from '../contexts/SyncContext';
import type { SyncResult } from '../types';

interface UseAutoSyncOptions {
  enabled?: boolean;
  intervalMinutes?: number; // How often to sync in minutes
  onSyncComplete?: (result: SyncResult) => void;
  onSyncError?: (error: Error) => void;
}

export function useAutoSync(options: UseAutoSyncOptions = {}) {
  const {
    enabled = true,
    intervalMinutes = 5,
    onSyncComplete,
    onSyncError,
  } = options;

  const { user, orgLoading } = useAuth();
  const {
    isSyncing,
    setIsSyncing,
    setSyncResult,
    setSyncError,
    refreshPendingCount,
  } = useSyncStatus();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Perform sync operation
   */
  const performSync = async (silent = false) => {
    // Only sync if user is authenticated and sync is enabled
    if (!user || !enabled) {
      return;
    }

    // Prevent concurrent syncs
    if (isSyncing) {
      console.log('Sync already in progress, skipping...');
      return;
    }

    try {
      setIsSyncing(true);
      if (!silent) {
        console.log('Starting sync...');
      }

      const result = await syncWithSupabase();

      setSyncResult(result);

      if (!silent) {
        console.log('Sync completed:', result);
      }

      // Refresh pending changes count
      await refreshPendingCount();

      // Dispatch custom event to notify components
      window.dispatchEvent(new CustomEvent('syncComplete', {
        detail: result
      }));

      if (onSyncComplete) {
        onSyncComplete(result);
      }

      return result;
    } catch (error: any) {
      console.error('Sync failed:', error);

      setSyncError(error.message);

      if (onSyncError) {
        onSyncError(error);
      }

      throw error;
    } finally {
      setIsSyncing(false);
    }
  };

  /**
   * Manual sync trigger
   */
  const triggerSync = () => {
    return performSync(false);
  };

  // Effect: Sync on mount (app startup) - wait for org context to be established first
  useEffect(() => {
    if (!user || !enabled || orgLoading) return;

    const startup = async () => {
      console.log('App started, performing initial sync...');

      // One-time repair: records previously pushed without org_id have org_id = NULL in
      // Supabase, so other devices can't pull them. Then clear our own lastSync
      // to force a full pull this session.
      const repairKey = `org_id_repair_v2_done_${user.id}`;
      if (!localStorage.getItem(repairKey)) {
        console.log('[Sync] Running one-time org_id repair push...');
        try {
          await pushAllToSupabase(); // No timestamp bumping; preserves original updatedAt so conflict resolution works correctly
          await clearLastSyncTimestamp(); // force full pull on this device too
          localStorage.setItem(repairKey, '1');
          console.log('[Sync] org_id repair complete');
        } catch (err) {
          console.warn('[Sync] org_id repair push failed:', err);
        }
      }

      // One-time backfill for the GHL lead pipeline. Devices may already have a
      // sync cursor newer than webhook-created lead rows, so force one full pull
      // after the lead tables are introduced.
      const leadPipelineBackfillKey = `lead_pipeline_backfill_v1_done_${user.id}`;
      const needsLeadPipelineBackfill = !localStorage.getItem(leadPipelineBackfillKey);
      if (needsLeadPipelineBackfill) {
        console.log('[Sync] Clearing sync cursor for lead pipeline backfill...');
        await clearLastSyncTimestamp();
      }

      // Auto cloud backup disabled - was causing database issues
      // To re-enable, restore the daily backup block here

      const result = await performSync(true); // Silent sync on startup
      if (needsLeadPipelineBackfill && result?.success) {
        localStorage.setItem(leadPipelineBackfillKey, '1');
        console.log('[Sync] Lead pipeline backfill complete');
      }
    };

    startup();
  }, [user, enabled, orgLoading]);

  // Effect: Set up periodic sync interval
  useEffect(() => {
    if (user && enabled && intervalMinutes > 0) {
      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      // Set up new interval
      const intervalMs = intervalMinutes * 60 * 1000;
      intervalRef.current = setInterval(() => {
        console.log(`Periodic sync triggered (every ${intervalMinutes} minutes)`);
        performSync(true); // Silent periodic sync
      }, intervalMs);

      console.log(`Periodic sync enabled: every ${intervalMinutes} minutes`);
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [user, enabled, intervalMinutes]);

  // Effect: Sync when app comes back online
  useEffect(() => {
    const handleOnline = () => {
      if (user && enabled) {
        console.log('App came back online, syncing...');
        performSync(true);
      }
    };

    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [user, enabled]);

  return {
    triggerSync,
  };
}
