import type { Job, JobStatus } from '../types/index.js';

export const JOB_WORKING_SET_MONTHS = 18;

export interface JobWorkingSetCutoff {
  date: string;
  timestamp: string;
}

const ACTIVE_JOB_STATUSES: JobStatus[] = ['Pending', 'Verbal'];

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getJobWorkingSetCutoff(
  now = new Date(),
  months = JOB_WORKING_SET_MONTHS
): JobWorkingSetCutoff {
  const cutoff = new Date(now.getTime());
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);

  return {
    date: toDateOnly(cutoff),
    timestamp: cutoff.toISOString(),
  };
}

export function isJobInWorkingSet(job: Pick<Job, 'status' | 'installDate' | 'updatedAt'>, cutoff: JobWorkingSetCutoff): boolean {
  if (ACTIVE_JOB_STATUSES.includes(job.status)) return true;
  if (job.installDate && job.installDate >= cutoff.date) return true;
  if (job.updatedAt && job.updatedAt >= cutoff.timestamp) return true;
  return false;
}

export function buildJobWorkingSetOrFilter(cutoff: JobWorkingSetCutoff): string {
  return [
    'status.in.(Pending,Verbal)',
    `install_date.gte.${cutoff.date}`,
    `updated_at.gte.${cutoff.timestamp}`,
  ].join(',');
}
