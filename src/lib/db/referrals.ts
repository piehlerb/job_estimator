/** Referral services and associates. */
import { ReferralAssociate, ReferralService } from '../../types';
import { getDB, queueForSync, triggerBackgroundSync } from './core';

// ─── Referral Services (tag pool) ─────────────────────────────────────────────

export async function getAllReferralServicesForSync(): Promise<ReferralService[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('referralServices', 'readonly');
    const store = tx.objectStore('referralServices');
    const req = store.getAll();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result || []);
  });
}

export async function getAllReferralServices(): Promise<ReferralService[]> {
  const all = await getAllReferralServicesForSync();
  return all.filter(s => !s.deleted);
}

export async function addReferralService(service: ReferralService): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('referralServices', 'readwrite');
    const store = tx.objectStore('referralServices');
    const req = store.put(service);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
  await queueForSync('referralServices', service.id, 'create');
  await triggerBackgroundSync();
}

export async function updateReferralService(service: ReferralService): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('referralServices', 'readwrite');
    const store = tx.objectStore('referralServices');
    const req = store.put(service);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
  await queueForSync('referralServices', service.id, 'update');
  await triggerBackgroundSync();
}

export async function deleteReferralService(id: string): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('referralServices', 'readwrite');
    const store = tx.objectStore('referralServices');
    const getReq = store.get(id);
    getReq.onerror = () => reject(getReq.error);
    getReq.onsuccess = () => {
      const item = getReq.result;
      if (item) {
        item.deleted = true;
        item.updatedAt = new Date().toISOString();
        const putReq = store.put(item);
        putReq.onerror = () => reject(putReq.error);
        putReq.onsuccess = () => resolve();
      } else {
        resolve();
      }
    };
  });
  await queueForSync('referralServices', id, 'delete');
  await triggerBackgroundSync();
}

// ─── Referral Associates ──────────────────────────────────────────────────────

export async function getAllReferralAssociatesForSync(): Promise<ReferralAssociate[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('referralAssociates', 'readonly');
    const store = tx.objectStore('referralAssociates');
    const req = store.getAll();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result || []);
  });
}

export async function getAllReferralAssociates(): Promise<ReferralAssociate[]> {
  const all = await getAllReferralAssociatesForSync();
  return all.filter(a => !a.deleted);
}

export async function addReferralAssociate(associate: ReferralAssociate): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('referralAssociates', 'readwrite');
    const store = tx.objectStore('referralAssociates');
    const req = store.put(associate);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
  await queueForSync('referralAssociates', associate.id, 'create');
  await triggerBackgroundSync();
}

export async function updateReferralAssociate(associate: ReferralAssociate): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('referralAssociates', 'readwrite');
    const store = tx.objectStore('referralAssociates');
    const req = store.put(associate);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
  await queueForSync('referralAssociates', associate.id, 'update');
  await triggerBackgroundSync();
}

export async function deleteReferralAssociate(id: string): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('referralAssociates', 'readwrite');
    const store = tx.objectStore('referralAssociates');
    const getReq = store.get(id);
    getReq.onerror = () => reject(getReq.error);
    getReq.onsuccess = () => {
      const item = getReq.result;
      if (item) {
        item.deleted = true;
        item.updatedAt = new Date().toISOString();
        const putReq = store.put(item);
        putReq.onerror = () => reject(putReq.error);
        putReq.onsuccess = () => resolve();
      } else {
        resolve();
      }
    };
  });
  await queueForSync('referralAssociates', id, 'delete');
  await triggerBackgroundSync();
}
