import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  aggregateJobsByZip,
  applyZipToAddress,
  extractZipCandidates,
  filterJobsByZipDate,
  filterJobsByZipStatus,
  resolveNhMeZip,
  zipReportJobDate,
} from './zipGeography.js';

describe('NH/ME ZIP geography', () => {
  test('extracts standalone five-digit and ZIP+4 tokens without embedded or overlong digits', () => {
    assert.deepEqual(extractZipCandidates('14 Main St, Portland ME 04101-1234'), ['04101']);
    assert.deepEqual(extractZipCandidates('A04101, 041011, 04101-123, 04101-12345'), []);
    assert.deepEqual(extractZipCandidates('Manchester 03101; Portland 04101'), ['03101', '04101']);
  });

  test('uses the rightmost exact NH/ME registry member deterministically', () => {
    assert.deepEqual(resolveNhMeZip('Old reference 03101; ship to Portland, ME 04101-9999'), {
      zip: '04101',
      centroid: { state: 'ME', city: 'Portland', lat: 43.6606, lon: -70.2589 },
    });
  });

  test('does not fall back to an earlier NH/ME ZIP when the rightmost destination ZIP is out of scope', () => {
    assert.deepEqual(
      resolveNhMeZip('Old address Portland, ME 04101; ship to Boston, MA 02110'),
      { reason: 'out-of-scope-or-unrecognized' }
    );
  });

  test('rejects missing malformed and unsupported ZIP data without state-prefix inference', () => {
    assert.deepEqual(resolveNhMeZip(), { reason: 'missing' });
    assert.deepEqual(resolveNhMeZip('12 Main St'), { reason: 'missing' });
    assert.deepEqual(resolveNhMeZip('Portland 04101-123'), { reason: 'invalid-format' });
    assert.deepEqual(resolveNhMeZip('Boston 02110'), { reason: 'out-of-scope-or-unrecognized' });
  });

  test('counts every mapped job as an estimate and only exact Won/Lost statuses in outcome metrics', () => {
    const report = aggregateJobsByZip([
      { customerAddress: 'Portland, ME 04101', status: 'Won' },
      { customerAddress: 'Portland, ME 04101-2222', status: 'Lost' },
      { customerAddress: 'Manchester, NH 03101', status: 'Pending' },
      { customerAddress: 'Manchester, NH 03101', status: 'Verbal' },
      { customerAddress: '', status: 'Won' },
      { customerAddress: 'Boston 02110', status: 'Lost' },
    ]);

    assert.deepEqual(report.totals, { estimates: 4, won: 1, lost: 1 });
    assert.deepEqual(report.rows.map(({ zip, estimates, won, lost }) => ({ zip, estimates, won, lost })), [
      { zip: '03101', estimates: 2, won: 0, lost: 0 },
      { zip: '04101', estimates: 2, won: 1, lost: 1 },
    ]);
    assert.deepEqual(report.excluded, { missing: 1, 'invalid-format': 0, 'out-of-scope-or-unrecognized': 1 });
  });

  test('adds a ZIP to an address or replaces the rightmost existing ZIP token', () => {
    assert.equal(applyZipToAddress('12 Main St, Hampton, NH', '03842'), '12 Main St, Hampton, NH 03842');
    assert.equal(applyZipToAddress('12 Main St, Boston, MA 02110', '03842'), '12 Main St, Boston, MA 03842');
    assert.equal(applyZipToAddress('  ', '04101'), '04101');
    assert.throws(() => applyZipToAddress('12 Main St', '02110'), /recognized Maine or New Hampshire ZIP/);
  });

  test('uses estimate date with a created-date fallback and filters inclusively', () => {
    const jobs = [
      { id: 'estimate', estimateDate: '2026-06-10', installDate: '2026-07-10', createdAt: '2026-06-01T12:00:00.000Z' },
      { id: 'created', estimateDate: undefined, installDate: '2026-07-20', createdAt: '2026-06-20T12:00:00.000Z' },
      { id: 'old', estimateDate: '2025-12-31', installDate: '', createdAt: '2025-12-01T12:00:00.000Z' },
    ];

    assert.equal(zipReportJobDate(jobs[1], 'estimate'), '2026-06-20');
    assert.deepEqual(
      filterJobsByZipDate(jobs, 'estimate', '2026-06-10', '2026-06-20').map(({ id }) => id),
      ['estimate', 'created']
    );
    assert.deepEqual(
      filterJobsByZipDate(jobs, 'install', '2026-07-15', '2026-07-31').map(({ id }) => id),
      ['created']
    );
  });

  test('filters jobs by any selected status and supports an empty selection', () => {
    const jobs = [
      { id: 'pending', status: 'Pending' as const },
      { id: 'verbal', status: 'Verbal' as const },
      { id: 'won', status: 'Won' as const },
      { id: 'lost', status: 'Lost' as const },
    ];

    assert.deepEqual(
      filterJobsByZipStatus(jobs, ['Pending', 'Won']).map(({ id }) => id),
      ['pending', 'won']
    );
    assert.deepEqual(filterJobsByZipStatus(jobs, []), []);
  });
});
