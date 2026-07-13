/**
 * Sync Queue
 * Batches and tracks pending changes for efficient synchronization
 */

export interface PendingChange {
  storeName: string;
  recordId: string;
  operation: 'create' | 'update' | 'delete';
  timestamp: string;
}

interface SyncQueueState {
  id: string;
  pendingChanges: PendingChange[];
  lastProcessed: string;
  updatedAt: string;
}

const SYNC_QUEUE_KEY = 'sync_queue';

/**
 * Get the sync queue from IndexedDB
 */
export async function getSyncQueue(): Promise<PendingChange[]> {
  try {
    const { openDB } = await import('./db');
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction('metadata', 'readonly');
      const store = tx.objectStore('metadata');
      const request = store.get(SYNC_QUEUE_KEY);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const state: SyncQueueState | undefined = request.result;
        resolve(state?.pendingChanges || []);
      };
    });
  } catch (error) {
    console.error('Error getting sync queue:', error);
    return [];
  }
}

/**
 * Add a change to the sync queue
 */
export async function addToSyncQueue(
  storeName: string,
  recordId: string,
  operation: 'create' | 'update' | 'delete'
): Promise<void> {
  try {
    const { openDB } = await import('./db');
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction('metadata', 'readwrite');
      const store = tx.objectStore('metadata');
      const getRequest = store.get(SYNC_QUEUE_KEY);

      getRequest.onerror = () => reject(getRequest.error);
      getRequest.onsuccess = () => {
        const state: SyncQueueState = getRequest.result || {
          id: SYNC_QUEUE_KEY,
          pendingChanges: [],
          lastProcessed: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Check if this record is already in the queue
        const existingIndex = state.pendingChanges.findIndex(
          (change) => change.storeName === storeName && change.recordId === recordId
        );

        // Timestamp must be strictly newer than any entry it replaces —
        // clearSyncQueue uses timestamp equality to tell a pushed entry
        // apart from one re-queued while that push was in flight
        let timestamp = new Date().toISOString();
        if (
          existingIndex >= 0 &&
          state.pendingChanges[existingIndex].timestamp >= timestamp
        ) {
          timestamp = new Date(
            new Date(state.pendingChanges[existingIndex].timestamp).getTime() + 1
          ).toISOString();
        }

        const newChange: PendingChange = {
          storeName,
          recordId,
          operation,
          timestamp,
        };

        if (existingIndex >= 0) {
          // Update existing entry (keeps most recent operation)
          state.pendingChanges[existingIndex] = newChange;
        } else {
          // Add new entry
          state.pendingChanges.push(newChange);
        }

        state.updatedAt = new Date().toISOString();

        const putRequest = store.put(state);
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      };
    });
  } catch (error) {
    console.error('Error adding to sync queue:', error);
  }
}

/**
 * Clear processed changes from the sync queue
 */
export async function clearSyncQueue(processedChanges?: PendingChange[]): Promise<void> {
  try {
    const { openDB } = await import('./db');
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction('metadata', 'readwrite');
      const store = tx.objectStore('metadata');
      const getRequest = store.get(SYNC_QUEUE_KEY);

      getRequest.onerror = () => reject(getRequest.error);
      getRequest.onsuccess = () => {
        const state: SyncQueueState = getRequest.result;

        if (!state) {
          resolve();
          return;
        }

        if (processedChanges) {
          // Remove only the processed changes. Timestamps must match: if a
          // record was re-queued while the push was in flight (its timestamp
          // changed), the newer edit must stay queued for the next push.
          state.pendingChanges = state.pendingChanges.filter(
            (change) =>
              !processedChanges.some(
                (processed) =>
                  processed.storeName === change.storeName &&
                  processed.recordId === change.recordId &&
                  processed.timestamp === change.timestamp
              )
          );
        } else {
          // Clear all changes
          state.pendingChanges = [];
        }

        state.lastProcessed = new Date().toISOString();
        state.updatedAt = new Date().toISOString();

        const putRequest = store.put(state);
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      };
    });
  } catch (error) {
    console.error('Error clearing sync queue:', error);
  }
}

/**
 * Check if there are pending changes to sync
 */
export async function hasPendingChanges(): Promise<boolean> {
  const queue = await getSyncQueue();
  return queue.length > 0;
}

/**
 * Get count of pending changes
 */
export async function getPendingChangesCount(): Promise<number> {
  const queue = await getSyncQueue();
  return queue.length;
}
