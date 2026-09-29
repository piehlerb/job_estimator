/** Jobs store. */
import { Job } from '../../types';
import { getDB, queueForSync, triggerBackgroundSync } from './core';

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

export async function getAllJobsByGroupId(groupId: string): Promise<Job[]> {
  const jobs = await getAllJobs();
  return jobs
    .filter((job: Job) => job.groupId === groupId)
    .sort((a: Job, b: Job) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
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

export async function getJobsByIds(ids: string[]): Promise<Job[]> {
  const uniqueIds = Array.from(new Set(ids));
  if (uniqueIds.length === 0) return [];

  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['jobs'], 'readonly');
    const store = transaction.objectStore('jobs');
    const jobs: Job[] = [];
    let pending = uniqueIds.length;
    let settled = false;

    const finishOne = () => {
      pending -= 1;
      if (pending === 0 && !settled) {
        settled = true;
        resolve(jobs);
      }
    };

    transaction.onerror = () => {
      if (!settled) {
        settled = true;
        reject(transaction.error);
      }
    };

    for (const id of uniqueIds) {
      const request = store.get(id);
      request.onerror = () => {
        if (!settled) {
          settled = true;
          reject(request.error);
        }
      };
      request.onsuccess = () => {
        if (request.result) {
          jobs.push(request.result);
        }
        finishOne();
      };
    }
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

  // Queue for sync
  await queueForSync('jobs', job.id, 'create');

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

  // Queue for sync
  await queueForSync('jobs', job.id, 'update');

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

  // Queue for sync
  await queueForSync('jobs', id, 'delete');

  // Trigger background sync
  await triggerBackgroundSync();
}
