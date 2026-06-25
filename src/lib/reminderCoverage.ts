import type { Job } from '../types/index.js';

type ReminderCarrier = {
  reminders?: Job['reminders'];
};

type JobWithReminderCoverage = ReminderCarrier & {
  createdAt: Job['createdAt'];
  deleted?: Job['deleted'];
  estimateDate?: Job['estimateDate'];
  status: Job['status'];
};

export function hasActiveReminder(job: ReminderCarrier): boolean {
  return (job.reminders ?? []).some((reminder) => reminder.completed !== true);
}

export function findPendingJobsWithoutActiveReminders<T extends JobWithReminderCoverage>(jobs: T[]): T[] {
  return jobs
    .filter((job) => job.status === 'Pending' && job.deleted !== true && !hasActiveReminder(job))
    .sort((a, b) => getReminderCoverageSortDate(a).localeCompare(getReminderCoverageSortDate(b)));
}

function getReminderCoverageSortDate(job: Pick<Job, 'createdAt' | 'estimateDate'>): string {
  return job.estimateDate || job.createdAt || '';
}
