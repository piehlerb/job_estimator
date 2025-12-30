import { Job, InstallDaySchedule } from '../types';
import { getAllJobs, updateJob } from './db';

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
