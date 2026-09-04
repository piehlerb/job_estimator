import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { resolveConflict, resolveRemoteWrite } from './syncHelpers.js';

/**
 * These pin the two invariants that kept auto-add reminder rules from
 * surviving. One pricing record holds fields owned by four different forms, so
 * both the write side and the pull side have to leave other owners' fields
 * alone.
 */

/**
 * Stand-in for db.updatePricing's merge. The real one reads the stored record
 * from IndexedDB, which is not available under node:test; the merge itself is
 * what the invariant rests on.
 */
function applyPatch<T extends Record<string, any>>(stored: T, patch: Partial<T>): T {
  return { ...stored, ...patch, id: 'current', updatedAt: '2026-09-01T00:00:00.000Z' };
}

const STORED = {
  id: 'current',
  minimumJobPrice: 2500,
  antiSlipPricePerSqft: 0.5,
  discountConfig: { mode: 'per_sqft', perSqftAmount: 1 },
  autoReminderRules: [
    { id: 'r1', subject: 'Follow up', daysAfterEstimate: 3, enabled: true },
    { id: 'r2', subject: 'Second touch', daysAfterEstimate: 10, enabled: true },
  ],
  updatedAt: '2026-08-01T00:00:00.000Z',
};

describe('settings saves only touch the fields their form owns', () => {
  test('saving a price leaves auto-reminder rules and discounts untouched', () => {
    const next = applyPatch(STORED, { antiSlipPricePerSqft: 0.75 });

    assert.equal(next.antiSlipPricePerSqft, 0.75);
    assert.deepEqual(next.autoReminderRules, STORED.autoReminderRules);
    assert.deepEqual(next.discountConfig, STORED.discountConfig);
  });

  test('saving discounts leaves auto-reminder rules untouched', () => {
    const next = applyPatch(STORED, {
      discountConfig: { mode: 'tag', perSqftAmount: 2 },
    });

    assert.deepEqual(next.autoReminderRules, STORED.autoReminderRules);
    assert.equal(next.minimumJobPrice, 2500);
  });

  test('a patch never carries a default over a stored value it did not name', () => {
    // The regression: pages held { ...getDefaultPricing(), ...stored } in state
    // and saved that, so a default of autoReminderRules: [] was written back as
    // though the user had chosen it. A patch cannot express that by accident.
    const next = applyPatch(STORED, { minimumJobPrice: 3000 });

    assert.equal((next.autoReminderRules as unknown[]).length, 2);
  });

  test('an owner clearing its own field still wins', () => {
    const next = applyPatch(STORED, { autoReminderRules: [] });

    assert.deepEqual(next.autoReminderRules, []);
  });

  test('the patch always refreshes updatedAt so the push is not judged stale', () => {
    const next = applyPatch(STORED, { minimumJobPrice: 3000 });

    assert.notEqual(next.updatedAt, STORED.updatedAt);
  });
});

describe('pulling a settings record cannot strip a field the server omitted', () => {
  const local = { ...STORED, updatedAt: '2026-08-01T00:00:00.000Z' };

  test('a remote row missing the column keeps the local rules', () => {
    // What a pull looked like before the pricing table had auto_reminder_rules:
    // every column present except that one.
    const { autoReminderRules: _omitted, ...remoteWithoutColumn } = STORED;
    const remote = { ...remoteWithoutColumn, updatedAt: '2026-08-02T00:00:00.000Z' };

    const { winner, source } = resolveConflict(local, remote as typeof local);
    assert.equal(source, 'remote');

    const stored = resolveRemoteWrite('pricing', local, winner);
    assert.deepEqual(stored.autoReminderRules, STORED.autoReminderRules);
    // The remote's own newer fields still land.
    assert.equal(stored.updatedAt, '2026-08-02T00:00:00.000Z');
  });

  test('an explicit empty array from the server is a real edit and wins', () => {
    const remote = {
      ...STORED,
      autoReminderRules: [],
      updatedAt: '2026-08-02T00:00:00.000Z',
    };

    const stored = resolveRemoteWrite('pricing', local, remote);
    assert.deepEqual(stored.autoReminderRules, []);
  });

  test('costs is guarded the same way', () => {
    const localCosts = { id: 'current', gasCost: 4, tintCostPerQuart: 9, updatedAt: '2026-08-01T00:00:00.000Z' };
    const remoteCosts = { id: 'current', gasCost: 5, updatedAt: '2026-08-02T00:00:00.000Z' };

    const stored = resolveRemoteWrite('costs', localCosts, remoteCosts as typeof localCosts);
    assert.equal(stored.gasCost, 5);
    assert.equal(stored.tintCostPerQuart, 9);
  });

  test('non-singleton tables still replace, so clearing an optional field sticks', () => {
    // Jobs legitimately clear optional fields; merging there would resurrect
    // values the user deleted.
    const localJob = { id: 'job-1', name: 'Job', installDate: '2026-09-01', updatedAt: '2026-08-01T00:00:00.000Z' };
    const remoteJob = { id: 'job-1', name: 'Job', updatedAt: '2026-08-02T00:00:00.000Z' };

    const stored = resolveRemoteWrite('jobs', localJob, remoteJob as typeof localJob);
    assert.equal('installDate' in stored, false);
  });
});
