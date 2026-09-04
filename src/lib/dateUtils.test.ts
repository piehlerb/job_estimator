import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { localToday, timestampToLocalDateString, toLocalDateString } from './dateUtils.js';

// These assertions hold in every timezone: each Date is built from local
// components, so the expected local calendar day never depends on the offset.
describe('local date helpers', () => {
  test('formats a date as its local calendar day', () => {
    assert.equal(toLocalDateString(new Date(2026, 6, 24, 9, 15)), '2026-07-24');
  });

  test('zero-pads single digit months and days', () => {
    assert.equal(toLocalDateString(new Date(2026, 0, 5)), '2026-01-05');
  });

  test('keeps the local day when the UTC day has already rolled over', () => {
    // 11:30 PM local. Anywhere behind UTC (including Eastern) this instant is
    // already tomorrow in UTC, which is exactly the off-by-one the helpers fix.
    const lateEvening = new Date(2026, 6, 24, 23, 30);

    assert.equal(toLocalDateString(lateEvening), '2026-07-24');
    assert.equal(timestampToLocalDateString(lateEvening.toISOString()), '2026-07-24');
  });

  test('keeps the local day when the UTC day has not yet caught up', () => {
    // 12:30 AM local. Anywhere ahead of UTC this instant is still yesterday in UTC.
    const earlyMorning = new Date(2026, 6, 24, 0, 30);

    assert.equal(toLocalDateString(earlyMorning), '2026-07-24');
    assert.equal(timestampToLocalDateString(earlyMorning.toISOString()), '2026-07-24');
  });

  test('localToday matches the local components of the current date', () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;

    assert.equal(localToday(), expected);
  });
});
