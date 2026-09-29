/** Leads, lead appointments and monthly ad spend. */
import { Lead, LeadAppointment, AdSpend } from '../../types';
import { softDeleteLead } from '../leadMutations';
import { getDB, queueForSync, triggerBackgroundSync } from './core';

// Leads
export async function getAllLeads(): Promise<Lead[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['leads'], 'readonly');
    const store = transaction.objectStore('leads');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const results = request.result || [];
      resolve(results.filter((lead: Lead) => !lead.deleted));
    };
  });
}

export async function getAllLeadsForSync(): Promise<Lead[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['leads'], 'readonly');
    const store = transaction.objectStore('leads');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function getLead(id: string): Promise<Lead | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['leads'], 'readonly');
    const store = transaction.objectStore('leads');
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const lead = request.result;
      resolve(lead && !lead.deleted ? lead : null);
    };
  });
}

export async function updateLead(lead: Lead): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['leads'], 'readwrite');
    const store = transaction.objectStore('leads');
    const request = store.put(lead);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });

  await queueForSync('leads', lead.id, 'update');
  await triggerBackgroundSync();
}

export async function deleteLead(id: string): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['leads'], 'readwrite');
    const store = transaction.objectStore('leads');
    const getRequest = store.get(id);

    getRequest.onerror = () => reject(getRequest.error);
    getRequest.onsuccess = () => {
      const lead = getRequest.result as Lead | undefined;
      if (lead) {
        const putRequest = store.put(softDeleteLead(lead));
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      } else {
        resolve();
      }
    };
  });

  await queueForSync('leads', id, 'delete');
  await triggerBackgroundSync();
}

export async function getAllLeadAppointments(): Promise<LeadAppointment[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['leadAppointments'], 'readonly');
    const store = transaction.objectStore('leadAppointments');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const results = request.result || [];
      resolve(results.filter((appointment: LeadAppointment) => !appointment.deleted));
    };
  });
}

export async function getAllLeadAppointmentsForSync(): Promise<LeadAppointment[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['leadAppointments'], 'readonly');
    const store = transaction.objectStore('leadAppointments');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function updateLeadAppointment(appointment: LeadAppointment): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['leadAppointments'], 'readwrite');
    const store = transaction.objectStore('leadAppointments');
    const request = store.put(appointment);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });

  await queueForSync('leadAppointments', appointment.id, 'update');
  await triggerBackgroundSync();
}

export async function deleteLeadAppointment(id: string): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['leadAppointments'], 'readwrite');
    const store = transaction.objectStore('leadAppointments');
    const getRequest = store.get(id);

    getRequest.onerror = () => reject(getRequest.error);
    getRequest.onsuccess = () => {
      const appointment = getRequest.result;
      if (appointment) {
        appointment.deleted = true;
        appointment.updatedAt = new Date().toISOString();
        const putRequest = store.put(appointment);
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      } else {
        resolve();
      }
    };
  });

  await queueForSync('leadAppointments', id, 'delete');
  await triggerBackgroundSync();
}

export async function getAllAdSpend(): Promise<AdSpend[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['adSpend'], 'readonly');
    const store = transaction.objectStore('adSpend');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const results = request.result || [];
      resolve(results.filter((record: AdSpend) => !record.deleted));
    };
  });
}

// Sync version - returns all records including deleted
export async function getAllAdSpendForSync(): Promise<AdSpend[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['adSpend'], 'readonly');
    const store = transaction.objectStore('adSpend');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function updateAdSpend(record: AdSpend): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['adSpend'], 'readwrite');
    const store = transaction.objectStore('adSpend');
    const request = store.put(record);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });

  await queueForSync('adSpend', record.id, 'update');
  await triggerBackgroundSync();
}

/**
 * Set the advertising spend for a calendar month (YYYY-MM).
 * Updates the existing record for that month if one exists, otherwise creates one.
 */
export async function setAdSpendForMonth(month: string, amount: number): Promise<AdSpend> {
  const existing = (await getAllAdSpend()).find((r) => r.month === month);
  const now = new Date().toISOString();
  const record: AdSpend = existing
    ? { ...existing, amount, updatedAt: now }
    : {
        id: crypto.randomUUID(),
        month,
        amount,
        createdAt: now,
        updatedAt: now,
      };
  await updateAdSpend(record);
  return record;
}

export async function deleteAdSpend(id: string): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['adSpend'], 'readwrite');
    const store = transaction.objectStore('adSpend');
    const getRequest = store.get(id);

    getRequest.onerror = () => reject(getRequest.error);
    getRequest.onsuccess = () => {
      const record = getRequest.result;
      if (record) {
        record.deleted = true;
        record.updatedAt = new Date().toISOString();
        const putRequest = store.put(record);
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      } else {
        resolve();
      }
    };
  });

  await queueForSync('adSpend', id, 'delete');
  await triggerBackgroundSync();
}
