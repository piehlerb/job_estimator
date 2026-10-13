import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { projectInventoryAfterJobs, type ProjectionNeed } from './inventoryProjection.js';

const coat = (amount: number, onHand = 10): ProjectionNeed => ({
  key: 'coating:topA:Original:',
  label: 'Top A',
  unit: 'gal',
  amount,
  onHand,
});

const chip = (amount: number, onHand = 100): ProjectionNeed => ({
  key: 'chip:Domino',
  label: 'Domino',
  unit: 'lbs',
  amount,
  onHand,
  reclaimable: true,
});

describe('projectInventoryAfterJobs', () => {
  test('draws each material down job by job', () => {
    const result = projectInventoryAfterJobs([
      { id: 'a', needs: [coat(4)] },
      { id: 'b', needs: [coat(5)] },
      { id: 'c', needs: [coat(3)] },
    ]);
    assert.deepEqual(result.get('a')!.map((l) => [l.before, l.after]), [[10, 6]]);
    assert.deepEqual(result.get('b')!.map((l) => [l.before, l.after]), [[6, 1]]);
    assert.deepEqual(result.get('c')!.map((l) => [l.before, l.after]), [[1, -2]]);
  });

  test('jobs that do not use a material leave its balance alone', () => {
    const result = projectInventoryAfterJobs([
      { id: 'a', needs: [coat(4)] },
      { id: 'b', needs: [chip(30)] },
      { id: 'c', needs: [coat(2)] },
    ]);
    assert.equal(result.get('b')!.length, 1);
    assert.equal(result.get('c')![0].before, 6);
    assert.equal(result.get('c')![0].after, 4);
  });

  test('merges needs that share a key and skips zero amounts', () => {
    const result = projectInventoryAfterJobs([{ id: 'a', needs: [coat(2), coat(3), chip(0)] }]);
    const lines = result.get('a')!;
    assert.equal(lines.length, 1);
    assert.equal(lines[0].needed, 5);
    assert.equal(lines[0].after, 5);
  });

  test('reclaimed chip from earlier jobs offsets inventory draw', () => {
    const result = projectInventoryAfterJobs(
      [
        { id: 'a', needs: [chip(40)] },
        { id: 'b', needs: [chip(40)] },
        { id: 'c', needs: [chip(5)] },
      ],
      0.25
    );
    const a = result.get('a')![0];
    assert.equal(a.fromReclaim, 0);
    assert.equal(a.after, 60);
    // 10 lbs reclaimed from job a
    const b = result.get('b')![0];
    assert.equal(b.fromReclaim, 10);
    assert.equal(b.fromInventory, 30);
    assert.equal(b.after, 30);
    // 10 lbs reclaimed from job b covers all of job c
    const c = result.get('c')![0];
    assert.equal(c.fromReclaim, 5);
    assert.equal(c.fromInventory, 0);
    assert.equal(c.after, 30);
  });

  test('non-chip materials are never offset by reclaim', () => {
    const result = projectInventoryAfterJobs(
      [
        { id: 'a', needs: [coat(4)] },
        { id: 'b', needs: [coat(4)] },
      ],
      0.5
    );
    assert.equal(result.get('b')![0].fromReclaim, 0);
    assert.equal(result.get('b')![0].after, 2);
  });
});
