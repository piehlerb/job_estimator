/** Laborers store. */
import { Laborer } from '../../types';
import { getDB, queueForSync, triggerBackgroundSync } from './core';

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

  // Queue for sync
  await queueForSync('laborers', laborer.id, 'create');

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

  // Queue for sync
  await queueForSync('laborers', laborer.id, 'update');

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

  // Queue for sync
  await queueForSync('laborers', id, 'delete');

  // Trigger background sync
  await triggerBackgroundSync();
}
