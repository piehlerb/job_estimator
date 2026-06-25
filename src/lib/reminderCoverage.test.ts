import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  findPendingJobsWithoutActiveReminders,
  hasActiveReminder,
} from './reminderCoverage.js';
import type { Job, JobReminder } from '../types/index.js';

function makeReminder(overrides: Partial<JobReminder> = {}): JobReminder {
  return {
    id: 'reminder-1',
    subject: 'Follow up',
    dueDate: '2026-06-30',
    dueTime: '09:00',
    dueAt: '2026-06-30T13:00:00.000Z',
    completed: false,
    createdAt: '2026-06-25T12:00:00.000Z',
    updatedAt: '2026-06-25T12:00:00.000Z',
    ...overrides,
  };
}

function makeJob(overrides: Partial<Job>): Job {
  return {
    id: 'job-1',
    name: 'Garage',
    systemId: 'system-1',
    floorFootage: 500,
    verticalFootage: 0,
    crackFillFactor: 0,
    travelDistance: 0,
    installDate: '2026-07-01',
    installDays: 1,
    jobHours: 8,
    totalPrice: 5000,
    status: 'Pending',
    estimateDate: '2026-06-20',
    costsSnapshot: {} as Job['costsSnapshot'],
    systemSnapshot: {} as Job['systemSnapshot'],
    laborersSnapshot: [],
    createdAt: '2026-06-20T10:00:00.000Z',
    updatedAt: '2026-06-20T10:00:00.000Z',
    synced: true,
    ...overrides,
  };
}

describe('reminder coverage', () => {
  test('treats incomplete reminders as active and completed reminders as inactive', () => {
    assert.equal(hasActiveReminder(makeJob({ reminders: [makeReminder()] })), true);
    assert.equal(hasActiveReminder(makeJob({ reminders: [makeReminder({ completed: true })] })), false);
    assert.equal(hasActiveReminder(makeJob({ reminders: [] })), false);
  });

  test('finds pending jobs without active reminders and sorts oldest estimate first', () => {
    const jobs = [
      makeJob({ id: 'covered', estimateDate: '2026-06-01', reminders: [makeReminder()] }),
      makeJob({ id: 'lost', status: 'Lost', estimateDate: '2026-05-01' }),
      makeJob({ id: 'deleted', deleted: true, estimateDate: '2026-04-01' }),
      makeJob({ id: 'newer', estimateDate: '2026-06-12' }),
      makeJob({ id: 'older', estimateDate: '2026-06-05', reminders: [makeReminder({ completed: true })] }),
    ];

    assert.deepEqual(
      findPendingJobsWithoutActiveReminders(jobs).map((job) => job.id),
      ['older', 'newer']
    );
  });
});
