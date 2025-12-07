import { ChipSystem, PricingVariable, Job, Costs, Laborer } from '../types';

const DB_NAME = 'JobEstimator';
const DB_VERSION = 3;

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
    };
  });
}

async function getDB(): Promise<IDBDatabase> {
  return initDB();
}

export async function getAllSystems(): Promise<ChipSystem[]> {
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
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['systems'], 'readwrite');
    const store = transaction.objectStore('systems');
    const request = store.add(system);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getAllPricingVariables(): Promise<PricingVariable[]> {
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
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pricingVariables'], 'readwrite');
    const store = transaction.objectStore('pricingVariables');
    const request = store.add(variable);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getAllJobs(): Promise<Job[]> {
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
    request.onsuccess = () => resolve(request.result || null);
  });
}

export async function addJob(job: Job): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['jobs'], 'readwrite');
    const store = transaction.objectStore('jobs');
    const request = store.add(job);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function updateJob(job: Job): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['jobs'], 'readwrite');
    const store = transaction.objectStore('jobs');
    const request = store.put(job);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function deleteJob(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['jobs'], 'readwrite');
    const store = transaction.objectStore('jobs');
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function updateSystem(system: ChipSystem): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['systems'], 'readwrite');
    const store = transaction.objectStore('systems');
    const request = store.put(system);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function deleteSystem(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['systems'], 'readwrite');
    const store = transaction.objectStore('systems');
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function updatePricingVariable(variable: PricingVariable): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pricingVariables'], 'readwrite');
    const store = transaction.objectStore('pricingVariables');
    const request = store.put(variable);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function deletePricingVariable(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pricingVariables'], 'readwrite');
    const store = transaction.objectStore('pricingVariables');
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
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
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['costs'], 'readwrite');
    const store = transaction.objectStore('costs');
    const request = store.put({ ...costs, id: 'current' });

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export function getDefaultCosts(): Costs {
  return {
    id: 'current',
    baseCostPerGal: 0,
    topCostPerGal: 0,
    crackFillCost: 0,
    gasCost: 0,
    consumablesCost: 0,
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
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function getActiveLaborers(): Promise<Laborer[]> {
  const all = await getAllLaborers();
  return all.filter((l) => l.isActive);
}

export async function addLaborer(laborer: Laborer): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['laborers'], 'readwrite');
    const store = transaction.objectStore('laborers');
    const request = store.add(laborer);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function updateLaborer(laborer: Laborer): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['laborers'], 'readwrite');
    const store = transaction.objectStore('laborers');
    const request = store.put(laborer);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function deleteLaborer(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['laborers'], 'readwrite');
    const store = transaction.objectStore('laborers');
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}
