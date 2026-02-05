/**
 * Sync Status Indicator
 * Shows sync status in the UI with error notifications
 */

import React, { useEffect, useState } from 'react';
import { useSyncStatus } from '../contexts/SyncContext';

export function SyncStatusIndicator() {
  const {
    isSyncing,
    lastSyncTime,
    syncError,
    pendingChangesCount,
    clearSyncError,
  } = useSyncStatus();

  const [showError, setShowError] = useState(false);

  useEffect(() => {
    if (syncError) {
      setShowError(true);
    }
  }, [syncError]);

  const handleDismissError = () => {
    setShowError(false);
    clearSyncError();
  };

  const getTimeSinceSync = () => {
    if (!lastSyncTime) return 'Never';
    const seconds = Math.floor((Date.now() - lastSyncTime.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <>
      {/* Sync Status Badge */}
      <div className="flex items-center gap-2 text-xs text-slate-300">
        {isSyncing ? (
          <>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              <span>Syncing...</span>
            </div>
          </>
        ) : pendingChangesCount > 0 ? (
          <>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-amber-400 rounded-full"></div>
              <span>{pendingChangesCount} pending</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span>Synced {getTimeSinceSync()}</span>
            </div>
          </>
        )}
      </div>

      {/* Error Toast */}
      {showError && syncError && (
        <div className="fixed bottom-4 right-4 z-50 max-w-md">
          <div className="bg-red-50 border border-red-200 rounded-lg shadow-lg p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg
                  className="w-5 h-5 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-red-900 mb-1">
                  Sync Failed
                </h3>
                <p className="text-sm text-red-700 break-words">{syncError}</p>
                <p className="text-xs text-red-600 mt-2">
                  Your changes are saved locally and will sync when the connection is
                  restored.
                </p>
              </div>
              <button
                onClick={handleDismissError}
                className="flex-shrink-0 text-red-400 hover:text-red-600"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
