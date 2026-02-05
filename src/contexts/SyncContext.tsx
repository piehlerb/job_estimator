/**
 * Sync Context
 * Provides sync status and error notifications throughout the app
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { SyncResult } from '../types';
import { hasPendingChanges, getPendingChangesCount } from '../lib/syncQueue';

interface SyncContextType {
  isSyncing: boolean;
  lastSyncResult: SyncResult | null;
  lastSyncTime: Date | null;
  syncError: string | null;
  pendingChangesCount: number;
  setIsSyncing: (syncing: boolean) => void;
  setSyncResult: (result: SyncResult) => void;
  setSyncError: (error: string | null) => void;
  clearSyncError: () => void;
  refreshPendingCount: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pendingChangesCount, setPendingChangesCount] = useState(0);

  const setSyncResult = useCallback((result: SyncResult) => {
    setLastSyncResult(result);
    setLastSyncTime(new Date());
    if (!result.success && result.errors.length > 0) {
      setSyncError(result.errors.join(', '));
    } else {
      setSyncError(null);
    }
  }, []);

  const clearSyncError = useCallback(() => {
    setSyncError(null);
  }, []);

  const refreshPendingCount = useCallback(async () => {
    const count = await getPendingChangesCount();
    setPendingChangesCount(count);
  }, []);

  // Refresh pending count periodically
  useEffect(() => {
    refreshPendingCount();
    const interval = setInterval(refreshPendingCount, 3000); // Every 3 seconds
    return () => clearInterval(interval);
  }, [refreshPendingCount]);

  return (
    <SyncContext.Provider
      value={{
        isSyncing,
        lastSyncResult,
        lastSyncTime,
        syncError,
        pendingChangesCount,
        setIsSyncing,
        setSyncResult,
        setSyncError,
        clearSyncError,
        refreshPendingCount,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSyncStatus() {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSyncStatus must be used within a SyncProvider');
  }
  return context;
}
