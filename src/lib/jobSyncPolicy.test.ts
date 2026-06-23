import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  buildJobWorkingSetOrFilter,
  getJobWorkingSetCutoff,
  isJobInWorkingSet,
} from './jobSyncPolicy.js';
import type { Job } from '../types/index.js';

const now = new Date('2026-06-23T12:00:00.000Z');

function makeJob(overrides: Partial<Job>): Job {
  return {
    id: 'job-1',
    name: 'Garage',
    systemId: 'system-1',
    floorFootage: 500,
    verticalFootage: 0,
    crackFillFactor: 0,
    travelDistance: 0,
    installDate: '2026-06-01',
    installDays: 1,
    jobHours: 8,
    totalPrice: 5000,
    status: 'Won',
    costsSnapshot: {} as Job['costsSnapshot'],
    systemSnapshot: {} as Job['systemSnapshot'],
    laborersSnapshot: [],
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-01T10:00:00.000Z',
    synced: true,
    ...overrides,
  };
}

describe('job sync working set policy', () => {
  test('uses a rolling 18 month cutoff by default', () => {
    const cutoff = getJobWorkingSetCutoff(now);

    assert.equal(cutoff.date, '2024-12-23');
    assert.equal(cutoff.timestamp, '2024-12-23T12:00:00.000Z');
  });

  test('keeps active jobs in the initial cache even when they are old', () => {
    const cutoff = getJobWorkingSetCutoff(now);

    assert.equal(isJobInWorkingSet(makeJob({ status: 'Pending', installDate: '2023-01-15' }), cutoff), true);
    assert.equal(isJobInWorkingSet(makeJob({ status: 'Verbal', installDate: '2022-04-10' }), cutoff), true);
  });

  test('keeps recently installed or recently updated completed jobs in the initial cache', () => {
    const cutoff = getJobWorkingSetCutoff(now);

    assert.equal(isJobInWorkingSet(makeJob({ status: 'Won', installDate: '2025-02-01' }), cutoff), true);
    assert.equal(
      isJobInWorkingSet(
        makeJob({
          status: 'Lost',
          installDate: '2023-02-01',
          updatedAt: '2026-06-22T09:00:00.000Z',
        }),
        cutoff
      ),
      true
    );
  });

  test('leaves old inactive jobs for explicit historical loading', () => {
    const cutoff = getJobWorkingSetCutoff(now);

    assert.equal(
      isJobInWorkingSet(
        makeJob({
          status: 'Won',
          installDate: '2023-02-01',
          updatedAt: '2023-03-01T09:00:00.000Z',
        }),
        cutoff
      ),
      false
    );
  });

  test('builds the Supabase OR filter for first-time job pulls', () => {
    const cutoff = getJobWorkingSetCutoff(now);

    assert.equal(
      buildJobWorkingSetOrFilter(cutoff),
      'status.in.(Pending,Verbal),install_date.gte.2024-12-23,updated_at.gte.2024-12-23T12:00:00.000Z'
    );
  });
});
