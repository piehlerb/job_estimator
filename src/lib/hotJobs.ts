import type { Job } from '../types/index.js';

// A regular synced tag keeps stars compatible with existing clients and backups.
export const HOT_JOB_TAG = 'Hot job';

export function isHotJob(job: Pick<Job, 'tags'>): boolean {
  return job.tags?.includes(HOT_JOB_TAG) ?? false;
}

export function setJobHot(job: Job, hot: boolean): Job {
  const tags = (job.tags ?? []).filter(tag => tag !== HOT_JOB_TAG);
  return { ...job, tags: hot ? [...tags, HOT_JOB_TAG] : tags, updatedAt: new Date().toISOString(), synced: false };
}
