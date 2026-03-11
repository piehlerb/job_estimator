import { Job, InstallDaySchedule, Customer } from '../types';
import { getAllJobs, updateJob, getAllCustomers, getAllCustomersForSync, addCustomer, deleteCustomer } from './db';

/**
 * Converts legacy job data (jobHours + selectedLaborers) to installSchedule format
 * - Divides total hours evenly across install days
 * - Assigns all laborers to each day
 */
export function convertLegacyJobToSchedule(job: Job): InstallDaySchedule[] | undefined {
  // If job already has a schedule, don't convert
  if (job.installSchedule && job.installSchedule.length > 0) {
    return job.installSchedule;
  }

  // Get laborers from snapshot (these are the "selected" laborers)
  const laborerIds = job.laborersSnapshot.map(l => l.id);

  // If no laborers or invalid data, return undefined
  if (laborerIds.length === 0 || job.installDays < 1) {
    return undefined;
  }

  // Divide total hours evenly across days
  const hoursPerDay = job.jobHours / job.installDays;

  // Create schedule with same laborers for each day
  const schedule: InstallDaySchedule[] = [];
  for (let day = 1; day <= job.installDays; day++) {
    schedule.push({
      day,
      hours: hoursPerDay,
      laborerIds: [...laborerIds], // Clone the array
    });
  }

  return schedule;
}

/**
 * Migrates all jobs in the database from legacy format to installSchedule format
 * Returns the number of jobs migrated
 */
export async function migrateAllJobsToSchedule(): Promise<number> {
  const jobs = await getAllJobs();
  let migratedCount = 0;

  for (const job of jobs) {
    // Skip if already has schedule
    if (job.installSchedule && job.installSchedule.length > 0) {
      continue;
    }

    // Convert to schedule
    const schedule = convertLegacyJobToSchedule(job);

    if (schedule) {
      // Update job with new schedule
      const updatedJob: Job = {
        ...job,
        installSchedule: schedule,
        updatedAt: new Date().toISOString(),
      };

      await updateJob(updatedJob);
      migratedCount++;
    }
  }

  return migratedCount;
}

/**
 * Seeds the customers store from existing job data (one-time migration).
 * Groups jobs by customer name (case-insensitive), picks the most recent
 * name casing and address per group, then inserts one Customer record.
 * Only runs when the customers store is completely empty, so it won't
 * overwrite any records the user has already created.
 */
export async function migrateCustomersFromJobs(): Promise<number> {
  // Only seed if the store is completely empty AND has never been seeded before.
  // getAllCustomersForSync includes soft-deleted records, so if migrated- records
  // exist (even deleted ones) we know a prior seed already ran and we should skip.
  const allIncludingDeleted = await getAllCustomersForSync();
  if (allIncludingDeleted.length > 0) return 0;

  const jobs = await getAllJobs();

  // Group jobs by lower-cased customer name
  type CustomerAccumulator = {
    name: string;
    address: string | undefined;
    nameUpdatedAt: string;
    addressUpdatedAt: string;
    createdAt: string;
    updatedAt: string;
  };

  const map = new Map<string, CustomerAccumulator>();

  for (const job of jobs) {
    const rawName = job.customerName?.trim();
    if (!rawName) continue;

    const key = rawName.toLowerCase();
    const jobUpdatedAt = job.updatedAt || job.createdAt || new Date().toISOString();
    const jobCreatedAt = job.createdAt || jobUpdatedAt;
    const rawAddress = job.customerAddress?.trim() || undefined;

    const entry = map.get(key);
    if (!entry) {
      map.set(key, {
        name: rawName,
        address: rawAddress,
        nameUpdatedAt: jobUpdatedAt,
        addressUpdatedAt: rawAddress ? jobUpdatedAt : '',
        createdAt: jobCreatedAt,
        updatedAt: jobUpdatedAt,
      });
    } else {
      // Use the name from the most-recently-updated job
      if (jobUpdatedAt > entry.nameUpdatedAt) {
        entry.name = rawName;
        entry.nameUpdatedAt = jobUpdatedAt;
      }
      // Use the address from the most-recently-updated job that has one
      if (rawAddress && jobUpdatedAt > entry.addressUpdatedAt) {
        entry.address = rawAddress;
        entry.addressUpdatedAt = jobUpdatedAt;
      }
      // Track overall earliest createdAt and latest updatedAt
      if (jobCreatedAt < entry.createdAt) entry.createdAt = jobCreatedAt;
      if (jobUpdatedAt > entry.updatedAt) entry.updatedAt = jobUpdatedAt;
    }
  }

  if (map.size === 0) return 0;

  // Generate a stable deterministic ID: simple hash of "name-key"
  // Using a simple approach compatible with the browser environment
  function simpleId(key: string): string {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = (Math.imul(31, hash) + key.charCodeAt(i)) | 0;
    }
    const h = Math.abs(hash).toString(16).padStart(8, '0');
    // Pad to look like a normal app ID
    return `migrated-${h}-${key.replace(/[^a-z0-9]/g, '').substring(0, 8)}`;
  }

  let count = 0;
  for (const [key, entry] of map) {
    const customer: Customer = {
      id: simpleId(key),
      name: entry.name,
      address: entry.address,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
    await addCustomer(customer);
    count++;
  }

  return count;
}

/**
 * Removes duplicate "migrated-" customers that have a real counterpart.
 * When a real customer (non-migrated ID) exists with the same name (case-insensitive)
 * as a migrated- customer, the migrated- record is soft-deleted.
 * Returns the number of duplicates removed.
 */
export async function cleanupMigratedCustomerDuplicates(): Promise<number> {
  const all = await getAllCustomers();

  const realByName = new Map<string, Customer>();
  const migratedByName = new Map<string, Customer>();

  for (const customer of all) {
    const key = customer.name.trim().toLowerCase();
    if (customer.id.startsWith('migrated-')) {
      migratedByName.set(key, customer);
    } else {
      realByName.set(key, customer);
    }
  }

  let removed = 0;
  for (const [key, migrated] of migratedByName) {
    if (realByName.has(key)) {
      await deleteCustomer(migrated.id);
      removed++;
    }
  }

  return removed;
}
