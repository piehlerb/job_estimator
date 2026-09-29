/** Customers store. */
import { Customer } from '../../types';
import { getDB, queueForSync, triggerBackgroundSync } from './core';

// Customers
export async function getAllCustomers(): Promise<Customer[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['customers'], 'readonly');
    const store = transaction.objectStore('customers');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const results = request.result || [];
      resolve(results.filter((c: Customer) => !c.deleted));
    };
  });
}

// Sync version - returns all records including deleted
export async function getAllCustomersForSync(): Promise<Customer[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['customers'], 'readonly');
    const store = transaction.objectStore('customers');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function addCustomer(customer: Customer): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['customers'], 'readwrite');
    const store = transaction.objectStore('customers');
    const request = store.add(customer);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });

  await queueForSync('customers', customer.id, 'create');
  await triggerBackgroundSync();
}

export async function updateCustomer(customer: Customer): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['customers'], 'readwrite');
    const store = transaction.objectStore('customers');
    const request = store.put(customer);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });

  await queueForSync('customers', customer.id, 'update');
  await triggerBackgroundSync();
}

export async function deleteCustomer(id: string): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['customers'], 'readwrite');
    const store = transaction.objectStore('customers');
    const getRequest = store.get(id);

    getRequest.onerror = () => reject(getRequest.error);
    getRequest.onsuccess = () => {
      const customer = getRequest.result;
      if (customer) {
        customer.deleted = true;
        customer.updatedAt = new Date().toISOString();
        const putRequest = store.put(customer);
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      } else {
        resolve();
      }
    };
  });

  await queueForSync('customers', id, 'delete');
  await triggerBackgroundSync();
}
