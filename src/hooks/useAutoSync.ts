/**
 * Auto Sync Hook
 * Handles automatic synchronization with Supabase
 */

import { useEffect, useRef } from 'react';
import { syncWithSupabase } from '../lib/sync';
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

  const { user } = useAuth();
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

  // Effect: Sync on mount (app startup)
  useEffect(() => {
    if (user && enabled) {
      console.log('App started, performing initial sync...');
      performSync(true); // Silent sync on startup
    }
  }, [user, enabled]);

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
