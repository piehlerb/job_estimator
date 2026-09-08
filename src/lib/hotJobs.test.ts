import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Job } from '../types/index.js';
import { isHotJob, setJobHot } from './hotJobs.js';
import { getJobWorkingSetCutoff, isJobInWorkingSet } from './jobSyncPolicy.js';

test('starring and unstarring preserve other job data and queue a sync', () => {
  const original = { tags: ['Referral'], probability: 40, reminders: [], synced: true } as unknown as Job;
  const starred = setJobHot(original, true);
  assert.equal(isHotJob(starred), true);
  assert.equal(starred.synced, false);
  assert.equal(starred.probability, 40);
  assert.equal(starred.reminders, original.reminders);
  assert.deepEqual(original.tags, ['Referral']);
  assert.deepEqual(setJobHot(starred, true).tags, ['Referral', 'Hot job']);
  assert.deepEqual(setJobHot(starred, false).tags, ['Referral']);
  assert.equal(isHotJob({}), false);
});

test('old starred jobs stay in the working set until unstarred', () => {
  const job = { status: 'Lost', installDate: '2020-01-01', updatedAt: '2020-01-01T00:00:00Z', tags: ['Hot job'] } as Job;
  const cutoff = getJobWorkingSetCutoff(new Date('2026-09-08T12:00:00Z'));
  assert.equal(isJobInWorkingSet(job, cutoff), true);
  assert.equal(isJobInWorkingSet({ ...job, tags: [] }, cutoff), false);
});
