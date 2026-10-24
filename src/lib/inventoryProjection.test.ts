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

  test('reclaimed chip goes back into inventory after each job', () => {
    const result = projectInventoryAfterJobs(
      [
        { id: 'a', needs: [chip(40)] },
        { id: 'b', needs: [chip(40)] },
        { id: 'c', needs: [chip(5)] },
      ],
      0.25
    );
    // 40 used, 10 reclaimed
    const a = result.get('a')![0];
    assert.equal(a.needed, 40);
    assert.equal(a.reclaimed, 10);
    assert.equal(a.after, 70);
    const b = result.get('b')![0];
    assert.equal(b.before, 70);
    assert.equal(b.after, 40);
    const c = result.get('c')![0];
    assert.equal(c.reclaimed, 1.25);
    assert.equal(c.after, 36.25);
  });

  test('reclaimed chip is added to what is left after the job', () => {
    const result = projectInventoryAfterJobs(
      [
        { id: 'a', needs: [chip(150, 160)] },
        { id: 'b', needs: [chip(40, 160)] },
      ],
      0.5
    );
    // 160 - 150 = 10 left, + 75 reclaimed = 85
    assert.equal(result.get('a')![0].after, 85);
    // 85 - 40 = 45 left, + 20 reclaimed = 65
    assert.equal(result.get('b')![0].before, 85);
    assert.equal(result.get('b')![0].after, 65);
  });

  test('non-chip materials are never offset by reclaim', () => {
    const result = projectInventoryAfterJobs(
      [
        { id: 'a', needs: [coat(4)] },
        { id: 'b', needs: [coat(4)] },
      ],
      0.5
    );
    assert.equal(result.get('b')![0].reclaimed, 0);
    assert.equal(result.get('b')![0].after, 2);
  });
});
