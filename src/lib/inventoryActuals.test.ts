import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  buildInventoryActualDeltaRows,
  buildInventoryActualsSnapshot,
  buildInventoryActualsUpdate,
  buildInventoryReviewRows,
  hasInventoryActualsDelta,
  type InventoryActualsSource,
} from './inventoryActuals.js';

const baseSource: InventoryActualsSource = {
  actualBaseCoatGallons: 18,
  actualTopCoatGallons: 12,
  actualTintOz: 24,
  actualChipBoxes: 7,
  actualCrackRepairOz: 64,
  chipBlend: 'shoreline',
  baseColor: 'Grey',
  tintColor: 'Slate Gray',
  includeBasecoatTint: true,
  includeTopcoatTint: false,
};

describe('inventory actual delta rows', () => {
  test('snapshot omits zero and undefined material quantity fields', () => {
    const snapshot = buildInventoryActualsSnapshot(
      {
        actualBaseCoatGallons: undefined,
        actualTopCoatGallons: 0,
        actualChipBoxes: 0,
        chipBlend: 'shoreline',
      },
      '2026-06-12T10:00:00.000Z'
    );

    assert.equal(Object.prototype.hasOwnProperty.call(snapshot, 'actualBaseCoatGallons'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(snapshot, 'actualTopCoatGallons'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(snapshot, 'actualChipBoxes'), false);
  });

  test('snapshot omits negative material quantities and they produce no deltas', () => {
    const snapshot = buildInventoryActualsSnapshot(
      {
        actualBaseCoatGallons: -2,
        actualTopCoatGallons: -1,
        actualChipBoxes: -3,
        chipBlend: 'shoreline',
        baseColor: 'Grey',
      },
      '2026-06-12T10:00:00.000Z'
    );

    assert.equal(Object.prototype.hasOwnProperty.call(snapshot, 'actualBaseCoatGallons'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(snapshot, 'actualTopCoatGallons'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(snapshot, 'actualChipBoxes'), false);
    assert.deepEqual(buildInventoryActualDeltaRows(snapshot, undefined), []);
  });

  test('captures Cyclo1 actuals in the baseline without inventory deltas yet', () => {
    const snapshot = buildInventoryActualsSnapshot(
      { actualCyclo1Gallons: 4 },
      '2026-06-12T10:00:00.000Z'
    );

    assert.equal(snapshot.actualCyclo1Gallons, 4);
    assert.deepEqual(buildInventoryActualDeltaRows(snapshot, undefined), []);
  });

  test('first inventory update subtracts full current actuals from a zero baseline', () => {
    const current = buildInventoryActualsSnapshot(baseSource, '2026-06-12T10:00:00.000Z');
    const rows = buildInventoryActualDeltaRows(current, undefined);
    const byKey = Object.fromEntries(rows.map((row) => [row.key, row.usedDelta]));

    assert.equal(hasInventoryActualsDelta(current, undefined), true);
    assert.equal(byKey['chip:Shoreline'], 280);
    assert.equal(byKey['base:baseA'], 6);
    assert.equal(byKey['base:baseBGrey'], 12);
    assert.equal(byKey['top:topA'], 6);
    assert.equal(byKey['top:topB'], 6);
    assert.equal(byKey['tint:Slate Gray'], 24);
    assert.equal(byKey['misc:crackRepair'], 0.5);
  });

  test('saving with No leaves the baseline unchanged so a later Yes applies accumulated delta', () => {
    const baseline = buildInventoryActualsSnapshot({ ...baseSource, actualChipBoxes: 3 }, '2026-06-12T09:00:00.000Z');
    const current = buildInventoryActualsSnapshot({ ...baseSource, actualChipBoxes: 8 }, '2026-06-12T11:00:00.000Z');

    const chipRow = buildInventoryActualDeltaRows(current, baseline).find((row) => row.key === 'chip:Shoreline');
    assert.equal(chipRow?.usedDelta, 200);
  });

  test('update wrapper builds current snapshot and deltas from the stored baseline', () => {
    const baseline = buildInventoryActualsSnapshot({ ...baseSource, actualChipBoxes: 3 }, '2026-06-12T09:00:00.000Z');

    const result = buildInventoryActualsUpdate(
      { ...baseSource, actualChipBoxes: 8, inventoryActualsApplied: baseline },
      '2026-06-12T11:00:00.000Z'
    );

    const chipRow = result.deltas.find((row) => row.key === 'chip:Shoreline');
    assert.equal(result.snapshot.appliedAt, '2026-06-12T11:00:00.000Z');
    assert.equal(result.snapshot.actualChipBoxes, 8);
    assert.equal(chipRow?.usedDelta, 200);
  });

  test('later actual increases subtract only the increase', () => {
    const baseline = buildInventoryActualsSnapshot(baseSource, '2026-06-12T09:00:00.000Z');
    const current = buildInventoryActualsSnapshot({ ...baseSource, actualTopCoatGallons: 16 }, '2026-06-12T11:00:00.000Z');

    assert.deepEqual(
      buildInventoryActualDeltaRows(current, baseline)
        .filter((row) => row.key.startsWith('top:'))
        .map((row) => [row.key, row.usedDelta]),
      [
        ['top:topA', 2],
        ['top:topB', 2],
      ]
    );
  });

  test('later actual decreases add inventory back', () => {
    const baseline = buildInventoryActualsSnapshot(baseSource, '2026-06-12T09:00:00.000Z');
    const current = buildInventoryActualsSnapshot({ ...baseSource, actualChipBoxes: 6 }, '2026-06-12T11:00:00.000Z');

    const chipRow = buildInventoryActualDeltaRows(current, baseline).find((row) => row.key === 'chip:Shoreline');
    assert.equal(chipRow?.usedDelta, -40);
  });

  test('changed material identities reverse old inventory and apply new inventory', () => {
    const baseline = buildInventoryActualsSnapshot(baseSource, '2026-06-12T09:00:00.000Z');
    const current = buildInventoryActualsSnapshot(
      {
        ...baseSource,
        chipBlend: 'Creek Bed',
        baseColor: 'Tan',
        tintColor: 'Warm Umber',
      },
      '2026-06-12T11:00:00.000Z'
    );

    const byKey = Object.fromEntries(buildInventoryActualDeltaRows(current, baseline).map((row) => [row.key, row.usedDelta]));
    assert.equal(byKey['chip:Creek Bed'], 280);
    assert.equal(byKey['chip:Shoreline'], -280);
    assert.equal(byKey['base:baseBGrey'], -12);
    assert.equal(byKey['base:baseBTan'], 12);
    assert.equal(byKey['tint:Slate Gray'], -24);
    assert.equal(byKey['tint:Warm Umber'], 24);
    assert.equal(byKey['base:baseA'], undefined);
  });

  test('merged rows preserve base color warning', () => {
    const baseline = buildInventoryActualsSnapshot({ ...baseSource, actualBaseCoatGallons: 18 }, '2026-06-12T09:00:00.000Z');
    const current = buildInventoryActualsSnapshot(
      { ...baseSource, actualBaseCoatGallons: 18, baseColor: 'Custom Blue' },
      '2026-06-12T11:00:00.000Z'
    );

    const baseRow = buildInventoryActualDeltaRows(current, baseline).find((row) => row.key === 'base:baseA');

    assert.equal(baseRow?.usedDelta, 12);
    assert.equal(baseRow?.warning, 'No matching Base B inventory bucket exists for this base color.');
  });

  test('review rows default missing inventory to zero and calculate editable new values', () => {
    const current = buildInventoryActualsSnapshot(baseSource, '2026-06-12T10:00:00.000Z');
    const rows = buildInventoryReviewRows({
      deltas: buildInventoryActualDeltaRows(current, undefined),
      chipInventory: [],
      tintInventory: [],
      topCoatInventory: null,
      baseCoatInventory: null,
      miscInventory: null,
    });

    const chipRow = rows.find((row) => row.key === 'chip:Shoreline');
    assert.equal(chipRow?.currentValue, 0);
    assert.equal(chipRow?.newValue, -280);
    assert.equal(chipRow?.isMissingInventory, true);
    assert.equal(chipRow?.warning, 'Missing inventory record; current value is assumed to be 0.');
  });

  test('review rows combine missing inventory warning with existing delta warning', () => {
    const current = buildInventoryActualsSnapshot(
      { ...baseSource, baseColor: 'Custom Blue' },
      '2026-06-12T10:00:00.000Z'
    );
    const rows = buildInventoryReviewRows({
      deltas: buildInventoryActualDeltaRows(current, undefined),
      chipInventory: [],
      tintInventory: [],
      topCoatInventory: null,
      baseCoatInventory: null,
      miscInventory: null,
    });

    const baseRow = rows.find((row) => row.key === 'base:baseA');
    assert.equal(
      baseRow?.warning,
      'No matching Base B inventory bucket exists for this base color. Missing inventory record; current value is assumed to be 0.'
    );
  });
});
