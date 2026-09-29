/** IndexedDB setup and the sync plumbing every store module uses: opening/upgrading the database, queueing changes for Supabase, and the debounced background sync. */

const DB_NAME = 'JobEstimator';

const DB_VERSION = 22;

// Adds adSpend store (monthly advertising spend)

// Auto-sync flag - can be disabled for batch operations
let autoSyncEnabled = true;

/**
 * Enable or disable automatic sync after CRUD operations
 */
export function setAutoSync(enabled: boolean): void {
  autoSyncEnabled = enabled;
}

/**
 * Add a record to the sync queue
 */
export async function queueForSync(
  storeName: string,
  recordId: string,
  operation: 'create' | 'update' | 'delete'
): Promise<void> {
  try {
    const { addToSyncQueue } = await import('../syncQueue');
    await addToSyncQueue(storeName, recordId, operation);
  } catch (error) {
    console.warn('Failed to queue record for sync:', error);
  }
}

/**
 * Trigger a background sync (non-blocking)
 * This is called automatically after CRUD operations
 * Now uses a debounced approach to batch changes
 */
let syncTimeout: NodeJS.Timeout | null = null;

const SYNC_DEBOUNCE_MS = 2000;

// Wait 2 seconds after last change before syncing

export async function triggerBackgroundSync(): Promise<void> {
  if (!autoSyncEnabled) return;

  // Clear any existing timeout
  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }

  // Debounce: wait for changes to settle before syncing
  syncTimeout = setTimeout(async () => {
    try {
      // Dynamic import to avoid circular dependency
      const { syncWithSupabase } = await import('../sync');
      const { getCurrentUser } = await import('../auth');

      // Only sync if user is authenticated
      const user = await getCurrentUser();
      if (!user) {
        return; // Silently skip if not authenticated
      }

      // Run sync in background without blocking
      syncWithSupabase().catch(error => {
        console.warn('Background sync failed:', error);
        // Notify user of sync failure
        notifySyncError(error);
      });
    } catch (error) {
      // Silently fail - don't disrupt user operations
      console.warn('Failed to trigger background sync:', error);
    }
  }, SYNC_DEBOUNCE_MS);
}

/**
 * Notify user of sync errors
 */
async function notifySyncError(error: any): Promise<void> {
  console.error('Sync error:', error.message);

  // Try to update SyncContext if available
  try {
    // This is called from a non-React context, so we can't use hooks
    // The error will be caught by the sync function and displayed via SyncContext
  } catch {
    // Ignore - context may not be available
  }
}

export async function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      const ensureIndex = (
        store: IDBObjectStore,
        name: string,
        keyPath: string
      ) => {
        if (!store.indexNames.contains(name)) {
          store.createIndex(name, keyPath, { unique: false });
        }
      };

      if (!db.objectStoreNames.contains('systems')) {
        db.createObjectStore('systems', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('pricingVariables')) {
        db.createObjectStore('pricingVariables', { keyPath: 'id' });
      }
      const jobsStore = db.objectStoreNames.contains('jobs')
        ? request.transaction!.objectStore('jobs')
        : db.createObjectStore('jobs', { keyPath: 'id' });
      ensureIndex(jobsStore, 'installDate', 'installDate');
      ensureIndex(jobsStore, 'estimateDate', 'estimateDate');
      ensureIndex(jobsStore, 'createdAt', 'createdAt');
      ensureIndex(jobsStore, 'updatedAt', 'updatedAt');
      ensureIndex(jobsStore, 'status', 'status');
      ensureIndex(jobsStore, 'deleted', 'deleted');
      if (!db.objectStoreNames.contains('costs')) {
        db.createObjectStore('costs', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('pricing')) {
        db.createObjectStore('pricing', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('laborers')) {
        db.createObjectStore('laborers', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('chipBlends')) {
        db.createObjectStore('chipBlends', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('chipInventory')) {
        db.createObjectStore('chipInventory', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('topCoatInventory')) {
        db.createObjectStore('topCoatInventory', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('baseCoatInventory')) {
        db.createObjectStore('baseCoatInventory', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('miscInventory')) {
        db.createObjectStore('miscInventory', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('googleDriveAuth')) {
        db.createObjectStore('googleDriveAuth', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('googleDriveSettings')) {
        db.createObjectStore('googleDriveSettings', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('customers')) {
        db.createObjectStore('customers', { keyPath: 'id' });
      }
      const leadsStore = db.objectStoreNames.contains('leads')
        ? request.transaction!.objectStore('leads')
        : db.createObjectStore('leads', { keyPath: 'id' });
      ensureIndex(leadsStore, 'stage', 'stage');
      ensureIndex(leadsStore, 'updatedAt', 'updatedAt');
      ensureIndex(leadsStore, 'source', 'source');
      const leadAppointmentsStore = db.objectStoreNames.contains('leadAppointments')
        ? request.transaction!.objectStore('leadAppointments')
        : db.createObjectStore('leadAppointments', { keyPath: 'id' });
      ensureIndex(leadAppointmentsStore, 'leadId', 'leadId');
      ensureIndex(leadAppointmentsStore, 'scheduledStartAt', 'scheduledStartAt');
      ensureIndex(leadAppointmentsStore, 'updatedAt', 'updatedAt');
      if (!db.objectStoreNames.contains('products')) {
        db.createObjectStore('products', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('baseCoatColors')) {
        db.createObjectStore('baseCoatColors', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('tintInventory')) {
        db.createObjectStore('tintInventory', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('coatingInventory')) {
        db.createObjectStore('coatingInventory', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('shoppingItems')) {
        db.createObjectStore('shoppingItems', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('commTemplates')) {
        db.createObjectStore('commTemplates', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('referralAssociates')) {
        db.createObjectStore('referralAssociates', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('referralServices')) {
        db.createObjectStore('referralServices', { keyPath: 'id' });
      }
      const adSpendStore = db.objectStoreNames.contains('adSpend')
        ? request.transaction!.objectStore('adSpend')
        : db.createObjectStore('adSpend', { keyPath: 'id' });
      ensureIndex(adSpendStore, 'month', 'month');
      ensureIndex(adSpendStore, 'updatedAt', 'updatedAt');
    };
  });
}

export async function getDB(): Promise<IDBDatabase> {
  return initDB();
}

// Export openDB for sync module
export async function openDB(): Promise<IDBDatabase> {
  return initDB();
}
