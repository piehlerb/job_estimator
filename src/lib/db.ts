import { ChipSystem, PricingVariable, Job, Costs, Laborer, ChipInventory, TopCoatInventory, BaseCoatInventory, MiscInventory, GoogleDriveAuth, GoogleDriveSettings } from '../types';

const DB_NAME = 'JobEstimator';
const DB_VERSION = 8; // Incremented for metadata store

// Auto-sync flag - can be disabled for batch operations
let autoSyncEnabled = true;

/**
 * Enable or disable automatic sync after CRUD operations
 */
export function setAutoSync(enabled: boolean): void {
  autoSyncEnabled = enabled;
}

/**
 * Trigger a background sync (non-blocking)
 * This is called automatically after CRUD operations
 */
async function triggerBackgroundSync(): Promise<void> {
  if (!autoSyncEnabled) return;

  try {
    // Dynamic import to avoid circular dependency
    const { syncWithSupabase } = await import('./sync');
    const { getCurrentUser } = await import('./auth');

    // Only sync if user is authenticated
    const user = await getCurrentUser();
    if (!user) {
      return; // Silently skip if not authenticated
    }

    // Run sync in background without blocking
    syncWithSupabase().catch(error => {
      console.warn('Background sync failed:', error);
    });
  } catch (error) {
    // Silently fail - don't disrupt user operations
    console.warn('Failed to trigger background sync:', error);
  }
}

export async function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('systems')) {
        db.createObjectStore('systems', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('pricingVariables')) {
        db.createObjectStore('pricingVariables', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('jobs')) {
        db.createObjectStore('jobs', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('costs')) {
        db.createObjectStore('costs', { keyPath: 'id' });
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
    };
  });
}

async function getDB(): Promise<IDBDatabase> {
  return initDB();
}

// Export openDB for sync module
export async function openDB(): Promise<IDBDatabase> {
  return initDB();
}

export async function getAllSystems(): Promise<ChipSystem[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['systems'], 'readonly');
    const store = transaction.objectStore('systems');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const results = request.result || [];
      resolve(results.filter((system: ChipSystem) => !system.deleted));
    };
  });
}

// Sync version - returns all records including deleted
export async function getAllSystemsForSync(): Promise<ChipSystem[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['systems'], 'readonly');
    const store = transaction.objectStore('systems');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function addSystem(system: ChipSystem): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['systems'], 'readwrite');
    const store = transaction.objectStore('systems');
    const request = store.add(system);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });

  // Trigger background sync
  await triggerBackgroundSync();
}

export async function getAllPricingVariables(): Promise<PricingVariable[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pricingVariables'], 'readonly');
    const store = transaction.objectStore('pricingVariables');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const results = request.result || [];
      resolve(results.filter((variable: PricingVariable) => !variable.deleted));
    };
  });
}

// Sync version - returns all records including deleted
export async function getAllPricingVariablesForSync(): Promise<PricingVariable[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pricingVariables'], 'readonly');
    const store = transaction.objectStore('pricingVariables');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function addPricingVariable(variable: PricingVariable): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['pricingVariables'], 'readwrite');
    const store = transaction.objectStore('pricingVariables');
    const request = store.add(variable);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });

  // Trigger background sync
  await triggerBackgroundSync();
}

export async function getAllJobs(): Promise<Job[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['jobs'], 'readonly');
    const store = transaction.objectStore('jobs');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const results = request.result || [];
      resolve(results.filter((job: Job) => !job.deleted));
    };
  });
}

// Sync version - returns all records including deleted
export async function getAllJobsForSync(): Promise<Job[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['jobs'], 'readonly');
    const store = transaction.objectStore('jobs');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function getJob(id: string): Promise<Job | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['jobs'], 'readonly');
    const store = transaction.objectStore('jobs');
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const job = request.result;
      resolve(job && !job.deleted ? job : null);
    };
  });
}

export async function addJob(job: Job): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['jobs'], 'readwrite');
    const store = transaction.objectStore('jobs');
    const request = store.add(job);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });

  // Trigger background sync
  await triggerBackgroundSync();
}

export async function updateJob(job: Job): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['jobs'], 'readwrite');
    const store = transaction.objectStore('jobs');
    const request = store.put(job);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });

  // Trigger background sync
  await triggerBackgroundSync();
}

export async function deleteJob(id: string): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['jobs'], 'readwrite');
    const store = transaction.objectStore('jobs');
    const getRequest = store.get(id);

    getRequest.onerror = () => reject(getRequest.error);
    getRequest.onsuccess = () => {
      const job = getRequest.result;
      if (job) {
        job.deleted = true;
        job.updatedAt = new Date().toISOString();
        const putRequest = store.put(job);
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      } else {
        resolve();
      }
    };
  });

  // Trigger background sync
  await triggerBackgroundSync();
}

export async function updateSystem(system: ChipSystem): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['systems'], 'readwrite');
    const store = transaction.objectStore('systems');
    const request = store.put(system);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });

  // Trigger background sync
  await triggerBackgroundSync();
}

export async function deleteSystem(id: string): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['systems'], 'readwrite');
    const store = transaction.objectStore('systems');
    const getRequest = store.get(id);

    getRequest.onerror = () => reject(getRequest.error);
    getRequest.onsuccess = () => {
      const system = getRequest.result;
      if (system) {
        system.deleted = true;
        system.updatedAt = new Date().toISOString();
        const putRequest = store.put(system);
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      } else {
        resolve();
      }
    };
  });

  // Trigger background sync
  await triggerBackgroundSync();
}

export async function updatePricingVariable(variable: PricingVariable): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['pricingVariables'], 'readwrite');
    const store = transaction.objectStore('pricingVariables');
    const request = store.put(variable);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });

  // Trigger background sync
  await triggerBackgroundSync();
}

export async function deletePricingVariable(id: string): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['pricingVariables'], 'readwrite');
    const store = transaction.objectStore('pricingVariables');
    const getRequest = store.get(id);

    getRequest.onerror = () => reject(getRequest.error);
    getRequest.onsuccess = () => {
      const variable = getRequest.result;
      if (variable) {
        variable.deleted = true;
        variable.updatedAt = new Date().toISOString();
        const putRequest = store.put(variable);
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      } else {
        resolve();
      }
    };
  });

  // Trigger background sync
  await triggerBackgroundSync();
}

// Costs - we store a single costs record with id 'current'
export async function getCosts(): Promise<Costs | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['costs'], 'readonly');
    const store = transaction.objectStore('costs');
    const request = store.get('current');

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

export async function saveCosts(costs: Costs): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['costs'], 'readwrite');
    const store = transaction.objectStore('costs');
    const request = store.put({ ...costs, id: 'current' });

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });

  // Trigger background sync
  await triggerBackgroundSync();
}

export function getDefaultCosts(): Costs {
  return {
    id: 'current',
    baseCostPerGal: 0,
    topCostPerGal: 0,
    crackFillCost: 0,
    gasCost: 0,
    consumablesCost: 0,
    cyclo1CostPerGal: 0,
    tintCostPerQuart: 0,
    antiSlipCostPerGal: 0,
    abrasionResistanceCostPerGal: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Laborers
export async function getAllLaborers(): Promise<Laborer[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['laborers'], 'readonly');
    const store = transaction.objectStore('laborers');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const results = request.result || [];
      resolve(results.filter((laborer: Laborer) => !laborer.deleted));
    };
  });
}

// Sync version - returns all records including deleted
export async function getAllLaborersForSync(): Promise<Laborer[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['laborers'], 'readonly');
    const store = transaction.objectStore('laborers');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function getActiveLaborers(): Promise<Laborer[]> {
  const all = await getAllLaborers();
  return all.filter((l) => l.isActive);
}

export async function addLaborer(laborer: Laborer): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['laborers'], 'readwrite');
    const store = transaction.objectStore('laborers');
    const request = store.add(laborer);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });

  // Trigger background sync
  await triggerBackgroundSync();
}

export async function updateLaborer(laborer: Laborer): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['laborers'], 'readwrite');
    const store = transaction.objectStore('laborers');
    const request = store.put(laborer);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });

  // Trigger background sync
  await triggerBackgroundSync();
}

export async function deleteLaborer(id: string): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['laborers'], 'readwrite');
    const store = transaction.objectStore('laborers');
    const getRequest = store.get(id);

    getRequest.onerror = () => reject(getRequest.error);
    getRequest.onsuccess = () => {
      const laborer = getRequest.result;
      if (laborer) {
        laborer.deleted = true;
        laborer.updatedAt = new Date().toISOString();
        const putRequest = store.put(laborer);
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      } else {
        resolve();
      }
    };
  });

  // Trigger background sync
  await triggerBackgroundSync();
}

// Chip Blends - simple list of blend names
export interface ChipBlend {
  id: string;
  name: string;
  deleted?: boolean;
}

export async function getAllChipBlends(): Promise<ChipBlend[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['chipBlends'], 'readonly');
    const store = transaction.objectStore('chipBlends');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const results = request.result || [];
      resolve(results.filter((blend: ChipBlend) => !blend.deleted));
    };
  });
}

// Sync version - returns all records including deleted
export async function getAllChipBlendsForSync(): Promise<ChipBlend[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['chipBlends'], 'readonly');
    const store = transaction.objectStore('chipBlends');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function addChipBlend(blend: ChipBlend): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['chipBlends'], 'readwrite');
    const store = transaction.objectStore('chipBlends');
    const request = store.add(blend);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });

  // Trigger background sync
  await triggerBackgroundSync();
}

// Chip Inventory
export async function getAllChipInventory(): Promise<ChipInventory[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['chipInventory'], 'readonly');
    const store = transaction.objectStore('chipInventory');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const results = request.result || [];
      resolve(results.filter((inventory: ChipInventory) => !inventory.deleted));
    };
  });
}

// Sync version - returns all records including deleted
export async function getAllChipInventoryForSync(): Promise<ChipInventory[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['chipInventory'], 'readonly');
    const store = transaction.objectStore('chipInventory');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function saveChipInventory(inventory: ChipInventory): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['chipInventory'], 'readwrite');
    const store = transaction.objectStore('chipInventory');
    const request = store.put(inventory);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });

  // Trigger background sync
  await triggerBackgroundSync();
}

export async function deleteChipInventory(id: string): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['chipInventory'], 'readwrite');
    const store = transaction.objectStore('chipInventory');
    const getRequest = store.get(id);

    getRequest.onerror = () => reject(getRequest.error);
    getRequest.onsuccess = () => {
      const inventory = getRequest.result;
      if (inventory) {
        inventory.deleted = true;
        inventory.updatedAt = new Date().toISOString();
        const putRequest = store.put(inventory);
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      } else {
        resolve();
      }
    };
  });

  // Trigger background sync
  await triggerBackgroundSync();
}

// Top Coat Inventory - single record
export async function getTopCoatInventory(): Promise<TopCoatInventory | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['topCoatInventory'], 'readonly');
    const store = transaction.objectStore('topCoatInventory');
    const request = store.get('current');

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

export async function saveTopCoatInventory(inventory: TopCoatInventory): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['topCoatInventory'], 'readwrite');
    const store = transaction.objectStore('topCoatInventory');
    const request = store.put({ ...inventory, id: 'current' });

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });

  // Trigger background sync
  await triggerBackgroundSync();
}

// Base Coat Inventory - single record
export async function getBaseCoatInventory(): Promise<BaseCoatInventory | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['baseCoatInventory'], 'readonly');
    const store = transaction.objectStore('baseCoatInventory');
    const request = store.get('current');

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

export async function saveBaseCoatInventory(inventory: BaseCoatInventory): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['baseCoatInventory'], 'readwrite');
    const store = transaction.objectStore('baseCoatInventory');
    const request = store.put({ ...inventory, id: 'current' });

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });

  // Trigger background sync
  await triggerBackgroundSync();
}

// Misc Inventory
export async function getMiscInventory(): Promise<MiscInventory | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['miscInventory'], 'readonly');
    const store = transaction.objectStore('miscInventory');
    const request = store.get('current');

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

export async function saveMiscInventory(inventory: MiscInventory): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['miscInventory'], 'readwrite');
    const store = transaction.objectStore('miscInventory');
    const request = store.put({ ...inventory, id: 'current' });

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });

  // Trigger background sync
  await triggerBackgroundSync();
}

// Google Drive Auth
export async function getGoogleDriveAuth(): Promise<GoogleDriveAuth | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['googleDriveAuth'], 'readonly');
    const store = transaction.objectStore('googleDriveAuth');
    const request = store.get('current');

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

export async function saveGoogleDriveAuth(auth: GoogleDriveAuth): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['googleDriveAuth'], 'readwrite');
    const store = transaction.objectStore('googleDriveAuth');
    const request = store.put({ ...auth, id: 'current' });

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function deleteGoogleDriveAuth(): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['googleDriveAuth'], 'readwrite');
    const store = transaction.objectStore('googleDriveAuth');
    const request = store.delete('current');

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Google Drive Settings
export async function getGoogleDriveSettings(): Promise<GoogleDriveSettings | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['googleDriveSettings'], 'readonly');
    const store = transaction.objectStore('googleDriveSettings');
    const request = store.get('current');

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

export async function saveGoogleDriveSettings(settings: GoogleDriveSettings): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['googleDriveSettings'], 'readwrite');
    const store = transaction.objectStore('googleDriveSettings');
    const request = store.put({ ...settings, id: 'current' });

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export function getDefaultGoogleDriveSettings(): GoogleDriveSettings {
  return {
    id: 'current',
    rootFolderName: 'Jobs',
    autoUpload: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
