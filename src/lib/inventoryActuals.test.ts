import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  buildInventoryActualDeltaRows,
  buildInventoryActualsSnapshot,
  buildInventoryActualsUpdate,
  buildInventoryReviewRows,
  buildResolvedLines,
  hasInventoryActualsDelta,
  type InventoryActualsSource,
} from './inventoryActuals.js';
import type { InventoryActualsApplied } from '../types/index.js';
import {
  blendAllowsChipType,
  blendChipTypes,
  chipTypeLookup,
  distinctChipTypes,
  findChipInventoryItem,
  jobChipType,
  sameChipType,
} from './chipInventory.js';

/** Simulate a pre-Phase-4 snapshot that was stored without resolved lines. */
function asLegacySnapshot(source: InventoryActualsSource, appliedAt: string) {
  const snapshot = buildInventoryActualsSnapshot(source, appliedAt);
  delete snapshot.resolvedLines;
  return snapshot;
}

function approxEqual(actual: number | undefined, expected: number, message?: string) {
  assert.ok(
    actual !== undefined && Math.abs(actual - expected) < 1e-9,
    message ?? `expected ${actual} to be ~${expected}`
  );
}

const baseSource: InventoryActualsSource = {
  actualBaseCoatGallons: 18,
  actualTopCoatGallons: 12,
  actualTintOz: 24,
  actualChipBoxes: 7,
  actualCrackRepairOz: 64,
  actualMoistureMitigationGallons: 5,
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
    assert.equal(byKey['coating:baseA::'], 6);
    assert.equal(byKey['coating:baseB:Normal:Grey'], 12);
    assert.equal(byKey['coating:topA:Original:'], 6);
    assert.equal(byKey['coating:topB:Original:'], 6);
    assert.equal(byKey['tint:Slate Gray'], 24);
    assert.equal(byKey['misc:crackRepair'], 0.5);
    assert.equal(byKey['misc:moistureMitigation'], 5);
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
        .filter((row) => row.key.startsWith('coating:top'))
        .map((row) => [row.key, row.usedDelta]),
      [
        ['coating:topA:Original:', 2],
        ['coating:topB:Original:', 2],
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
    assert.equal(byKey['coating:baseB:Normal:Grey'], -12);
    assert.equal(byKey['coating:baseB:Normal:Tan'], 12);
    assert.equal(byKey['tint:Slate Gray'], -24);
    assert.equal(byKey['tint:Warm Umber'], 24);
    assert.equal(byKey['coating:baseA::'], undefined);
  });

  test('merged legacy rows preserve base color warning', () => {
    const baseline = asLegacySnapshot({ ...baseSource, actualBaseCoatGallons: 18 }, '2026-06-12T09:00:00.000Z');
    const current = asLegacySnapshot(
      { ...baseSource, actualBaseCoatGallons: 18, baseColor: 'Custom Blue' },
      '2026-06-12T11:00:00.000Z'
    );

    const baseRow = buildInventoryActualDeltaRows(current, baseline).find((row) => row.key === 'coating:baseA::');

    assert.equal(baseRow?.usedDelta, 12);
    assert.equal(baseRow?.warning, 'No matching Base B inventory bucket exists for this base color.');
  });

  test('moisture mitigation actuals update misc inventory by gallons', () => {
    const baseline = buildInventoryActualsSnapshot(
      { actualMoistureMitigationGallons: 2 },
      '2026-06-12T09:00:00.000Z'
    );
    const current = buildInventoryActualsSnapshot(
      { actualMoistureMitigationGallons: 6 },
      '2026-06-12T11:00:00.000Z'
    );

    const row = buildInventoryActualDeltaRows(current, baseline).find(
      (delta) => delta.key === 'misc:moistureMitigation'
    );

    assert.equal(row?.productName, 'Moisture Mitigation');
    assert.equal(row?.unit, 'gal');
    assert.equal(row?.usedDelta, 4);
  });

  test('review rows default missing inventory to zero and calculate editable new values', () => {
    const current = buildInventoryActualsSnapshot(baseSource, '2026-06-12T10:00:00.000Z');
    const rows = buildInventoryReviewRows({
      deltas: buildInventoryActualDeltaRows(current, undefined),
      chipInventory: [],
      tintInventory: [],
      coatingInventory: [],
      miscInventory: null,
    });

    const chipRow = rows.find((row) => row.key === 'chip:Shoreline');
    assert.equal(chipRow?.currentValue, 0);
    assert.equal(chipRow?.newValue, -280);
    assert.equal(chipRow?.isMissingInventory, true);
    assert.equal(chipRow?.warning, 'Missing inventory record; current value is assumed to be 0.');
  });

  test('review rows combine missing inventory warning with existing delta warning', () => {
    const current = asLegacySnapshot(
      { ...baseSource, baseColor: 'Custom Blue' },
      '2026-06-12T10:00:00.000Z'
    );
    const rows = buildInventoryReviewRows({
      deltas: buildInventoryActualDeltaRows(current, undefined),
      chipInventory: [],
      tintInventory: [],
      coatingInventory: [],
      miscInventory: null,
    });

    const baseRow = rows.find((row) => row.key === 'coating:baseA::');
    assert.equal(
      baseRow?.warning,
      'No matching Base B inventory bucket exists for this base color. Missing inventory record; current value is assumed to be 0.'
    );
  });
});

describe('allocation-aware resolved lines', () => {
  test('legacy snapshots without resolvedLines still reverse via derivation', () => {
    const baseline = asLegacySnapshot(baseSource, '2026-06-12T09:00:00.000Z');
    const current = buildInventoryActualsSnapshot(baseSource, '2026-06-12T11:00:00.000Z');

    assert.equal(Object.prototype.hasOwnProperty.call(baseline, 'resolvedLines'), false);
    assert.ok((current.resolvedLines?.length ?? 0) > 0);
    // Default allocation resolves to the same buckets the legacy derivation
    // produced, so reversing the legacy baseline nets out to no delta.
    assert.deepEqual(buildInventoryActualDeltaRows(current, baseline), []);
  });

  test('60/40 Original/Slow Cure top override resolves four top lines and targets Slow Cure SKUs', () => {
    const source: InventoryActualsSource = {
      actualTopCoatGallons: 12,
      materialAllocation: {
        top: [
          { variant: 'Original', share: 0.6 },
          { variant: 'Slow Cure', share: 0.4 },
        ],
      },
    };

    const snapshot = buildInventoryActualsSnapshot(source, '2026-06-12T10:00:00.000Z');
    const topLines = (snapshot.resolvedLines ?? []).filter((line) => line.key.startsWith('coating:top'));
    const byKey = Object.fromEntries(topLines.map((line) => [line.key, line.amount]));

    assert.equal(topLines.length, 4);
    approxEqual(byKey['coating:topA:Original:'], 3.6);
    approxEqual(byKey['coating:topB:Original:'], 3.6);
    approxEqual(byKey['coating:topA:Slow Cure:'], 2.4);
    approxEqual(byKey['coating:topB:Slow Cure:'], 2.4);

    const deltas = buildInventoryActualDeltaRows(snapshot, undefined);
    const slowCureA = deltas.find((row) => row.key === 'coating:topA:Slow Cure:');
    assert.deepEqual(slowCureA?.target, { kind: 'coating', part: 'topA', variant: 'Slow Cure', color: undefined });
    approxEqual(slowCureA?.usedDelta, 2.4);
  });

  test('all-Clear Mocha override splits combined actual tint oz proportionally', () => {
    const source: InventoryActualsSource = {
      actualBaseCoatGallons: 10,
      actualTintOz: 100,
      baseColor: 'Mocha',
      includeBasecoatTint: true,
      materialAllocation: {
        base: [
          { variant: 'Normal', color: 'Clear', share: 0.5, tintColor: 'Grey' },
          { variant: 'Normal', color: 'Clear', share: 0.5, tintColor: 'Tan' },
        ],
      },
    };

    const { lines } = buildResolvedLines(source);
    const tintLines = lines.filter((line) => line.key.startsWith('tint:'));
    const byKey = Object.fromEntries(tintLines.map((line) => [line.key, line.amount]));

    assert.equal(tintLines.length, 2);
    approxEqual(byKey['tint:Grey'], 50);
    approxEqual(byKey['tint:Tan'], 50);

    const deltas = buildInventoryActualDeltaRows(
      buildInventoryActualsSnapshot(source, '2026-06-12T10:00:00.000Z'),
      undefined
    );
    approxEqual(deltas.find((row) => row.key === 'tint:Grey')?.usedDelta, 50);
    approxEqual(deltas.find((row) => row.key === 'tint:Tan')?.usedDelta, 50);
  });

  test('reversal uses stored resolved lines when the allocation changed between applications', () => {
    const baseline = buildInventoryActualsSnapshot(
      { actualTopCoatGallons: 12, materialAllocation: { top: [{ variant: 'Slow Cure', share: 1 }] } },
      '2026-06-12T09:00:00.000Z'
    );
    const current = buildInventoryActualsSnapshot(
      { actualTopCoatGallons: 12 },
      '2026-06-12T11:00:00.000Z'
    );

    const byKey = Object.fromEntries(
      buildInventoryActualDeltaRows(current, baseline).map((row) => [row.key, row.usedDelta])
    );

    approxEqual(byKey['coating:topA:Slow Cure:'], -6);
    approxEqual(byKey['coating:topB:Slow Cure:'], -6);
    approxEqual(byKey['coating:topA:Original:'], 6);
    approxEqual(byKey['coating:topB:Original:'], 6);
  });

  test('legacy baseline reverses via derivation while new current applies stored lines', () => {
    const baseline = asLegacySnapshot(baseSource, '2026-06-12T09:00:00.000Z');
    const current = buildInventoryActualsSnapshot(
      { ...baseSource, materialAllocation: { top: [{ variant: 'Slow Cure', share: 1 }] } },
      '2026-06-12T11:00:00.000Z'
    );

    const byKey = Object.fromEntries(
      buildInventoryActualDeltaRows(current, baseline).map((row) => [row.key, row.usedDelta])
    );

    approxEqual(byKey['coating:topA:Original:'], -6);
    approxEqual(byKey['coating:topB:Original:'], -6);
    approxEqual(byKey['coating:topA:Slow Cure:'], 6);
    approxEqual(byKey['coating:topB:Slow Cure:'], 6);
    // Shared buckets net out to zero and drop from the delta list.
    assert.equal(byKey['coating:baseA::'], undefined);
    assert.equal(byKey['chip:Shoreline'], undefined);
  });

  test('resolver warnings surface on the first coating delta row via the update wrapper', () => {
    const { deltas } = buildInventoryActualsUpdate(
      {
        actualTopCoatGallons: 12,
        materialAllocation: { top: [{ variant: 'Original', share: 0.5 }, { variant: 'Slow Cure', share: 0.2 }] },
      },
      '2026-06-12T10:00:00.000Z'
    );

    const firstCoating = deltas.find((row) => row.target.kind === 'coating');
    assert.equal(firstCoating?.warning, 'Topcoat allocation shares do not sum to 100%.');
  });
});

describe('chip inventory split by chip type', () => {
  // "1/4" and "1/4 Outdoor" are different systems that use the same 1/4 chip
  const quarterSystem = 'sys-quarter';
  const quarterOutdoorSystem = 'sys-quarter-outdoor';
  const eighthSystem = 'sys-eighth';
  const chipTypeForSystem = chipTypeLookup([
    { id: quarterSystem, chipType: '1/4' },
    { id: quarterOutdoorSystem, chipType: '1/4' },
    { id: eighthSystem, chipType: '1/8' },
  ]);
  const chipOnly: InventoryActualsSource = { actualChipBoxes: 2, chipBlend: 'blue', chipType: '1/4', chipTypeForSystem };

  test('chip lines and snapshots carry the job chip type', () => {
    const snapshot = buildInventoryActualsSnapshot(chipOnly, '2026-06-12T10:00:00.000Z');
    assert.equal(snapshot.chipType, '1/4');
    assert.deepEqual(snapshot.resolvedLines?.[0].target, { kind: 'chip', blend: 'Blue', chipType: '1/4' });
    assert.equal(snapshot.resolvedLines?.[0].key, 'chip:Blue:1/4');
  });

  test('review rows pick the inventory row for the job chip type, not another type with the same blend', () => {
    const snapshot = buildInventoryActualsSnapshot(chipOnly, '2026-06-12T10:00:00.000Z');
    const [row] = buildInventoryReviewRows({
      deltas: buildInventoryActualDeltaRows(snapshot, undefined),
      chipInventory: [
        { id: 'blue-8', blend: 'Blue', chipType: '1/8', pounds: 500, updatedAt: '' },
        { id: 'blue-4', blend: 'Blue', chipType: '1/4', pounds: 120, updatedAt: '' },
      ],
      tintInventory: [],
      coatingInventory: [],
      miscInventory: null,
    });
    assert.equal(row.inventoryId, 'blue-4');
    assert.equal(row.newValue, 40);
  });

  test('review rows resolve legacy system-tagged stock through the system chip type', () => {
    const snapshot = buildInventoryActualsSnapshot(chipOnly, '2026-06-12T10:00:00.000Z');
    const [row] = buildInventoryReviewRows({
      deltas: buildInventoryActualDeltaRows(snapshot, undefined),
      chipInventory: [
        { id: 'blue-8', blend: 'Blue', systemId: eighthSystem, pounds: 500, updatedAt: '' },
        { id: 'blue-4-outdoor', blend: 'Blue', systemId: quarterOutdoorSystem, pounds: 120, updatedAt: '' },
      ],
      tintInventory: [],
      coatingInventory: [],
      miscInventory: null,
      chipTypeForSystem,
    });
    assert.equal(row.inventoryId, 'blue-4-outdoor');
  });

  test('review rows fall back to unassigned stock for the blend', () => {
    const snapshot = buildInventoryActualsSnapshot(chipOnly, '2026-06-12T10:00:00.000Z');
    const [row] = buildInventoryReviewRows({
      deltas: buildInventoryActualDeltaRows(snapshot, undefined),
      chipInventory: [
        { id: 'blue-8', blend: 'Blue', chipType: '1/8', pounds: 500, updatedAt: '' },
        { id: 'blue-legacy', blend: 'blue', pounds: 90, updatedAt: '' },
      ],
      tintInventory: [],
      coatingInventory: [],
      miscInventory: null,
    });
    assert.equal(row.inventoryId, 'blue-legacy');
  });

  test('legacy baseline without a chip type or system is reversed against the job chip type', () => {
    const baseline = buildInventoryActualsSnapshot({ ...chipOnly, chipType: undefined }, '2026-06-12T09:00:00.000Z');
    const legacyDerived = asLegacySnapshot({ ...chipOnly, chipType: undefined }, '2026-06-12T09:00:00.000Z');

    for (const legacy of [baseline, legacyDerived]) {
      const { deltas } = buildInventoryActualsUpdate(
        { ...chipOnly, actualChipBoxes: 3, inventoryActualsApplied: legacy },
        '2026-06-12T11:00:00.000Z'
      );
      assert.deepEqual(
        deltas.map((row) => [row.key, row.usedDelta]),
        [['chip:Blue:1/4', 40]]
      );
    }
  });

  test('baseline tagged with another system of the same chip type nets out against the new deduction', () => {
    // Applied while inventory was split by system, from the "1/4 Outdoor" system
    const withLines: InventoryActualsApplied = {
      appliedAt: '2026-06-12T09:00:00.000Z',
      chipBlend: 'Blue',
      actualChipBoxes: 2,
      chipSystemId: quarterOutdoorSystem,
      resolvedLines: [
        {
          key: `chip:Blue:${quarterOutdoorSystem}`,
          label: 'Blue Chips',
          unit: 'lbs',
          amount: 80,
          target: { kind: 'chip', blend: 'Blue', systemId: quarterOutdoorSystem },
        },
      ],
    };
    const derived: InventoryActualsApplied = { ...withLines, resolvedLines: undefined };

    for (const legacy of [withLines, derived]) {
      const { deltas } = buildInventoryActualsUpdate(
        { ...chipOnly, actualChipBoxes: 3, inventoryActualsApplied: legacy },
        '2026-06-12T11:00:00.000Z'
      );
      assert.deepEqual(
        deltas.map((row) => [row.key, row.usedDelta]),
        [['chip:Blue:1/4', 40]]
      );
    }
  });

  test('changing to a system with another chip type moves the deduction between buckets', () => {
    const baseline = buildInventoryActualsSnapshot({ ...chipOnly, chipType: '1/8' }, '2026-06-12T09:00:00.000Z');
    const { deltas } = buildInventoryActualsUpdate(
      { ...chipOnly, inventoryActualsApplied: baseline },
      '2026-06-12T11:00:00.000Z'
    );
    const byKey = Object.fromEntries(deltas.map((row) => [row.key, row.usedDelta]));
    assert.equal(byKey['chip:Blue:1/8'], -80);
    assert.equal(byKey['chip:Blue:1/4'], 80);
  });
});

describe('chip type helpers', () => {
  const lookup = chipTypeLookup([
    { id: 'quarter', chipType: '1/4' },
    { id: 'quarter-outdoor', chipType: ' 1/4 ' },
    { id: 'stone', chipType: 'Stone' },
    { id: 'grind', chipType: undefined },
  ]);

  test('chip types compare case- and whitespace-insensitively', () => {
    assert.equal(sameChipType('Stone', ' stone '), true);
    assert.equal(sameChipType('1/4', '1/8'), false);
    assert.equal(sameChipType(undefined, undefined), false);
  });

  test('distinct chip types sort sizes numerically', () => {
    assert.deepEqual(distinctChipTypes(['1/16', 'Stone', '1/4', '1/8', '1/4 ', undefined, 'stone']), [
      '1/4',
      '1/8',
      '1/16',
      'Stone',
    ]);
  });

  test('a job draws on its current system chip type, else its snapshot', () => {
    assert.equal(jobChipType({ systemId: 'quarter-outdoor', systemSnapshot: { chipType: '1/8' } }, lookup), '1/4');
    assert.equal(jobChipType({ systemId: 'deleted', systemSnapshot: { chipType: 'Stone' } }, lookup), 'Stone');
    assert.equal(jobChipType({ systemId: 'grind', systemSnapshot: {} }, lookup), undefined);
  });

  test('blends saved with systems are available for every system of those chip types', () => {
    const legacyBlend = { systemIds: ['quarter'] };
    assert.deepEqual(blendChipTypes(legacyBlend, lookup), ['1/4']);
    assert.equal(blendAllowsChipType(legacyBlend, '1/4', lookup), true);
    assert.equal(blendAllowsChipType(legacyBlend, 'Stone', lookup), false);
  });

  test('blend chip types win over legacy systems and an empty list allows any type', () => {
    assert.deepEqual(blendChipTypes({ chipTypes: ['Stone'], systemIds: ['quarter'] }, lookup), ['Stone']);
    assert.equal(blendAllowsChipType({ chipTypes: [] }, '1/8', lookup), true);
  });

  test('inventory lookup matches stock of the same chip type from any system', () => {
    const rows = [
      { id: 'a', blend: 'Blue', systemId: 'quarter-outdoor' },
      { id: 'b', blend: 'Blue', chipType: 'Stone' },
    ];
    assert.equal(findChipInventoryItem(rows, 'blue', '1/4', lookup)?.id, 'a');
    assert.equal(findChipInventoryItem(rows, 'blue', 'stone', lookup)?.id, 'b');
    assert.equal(findChipInventoryItem(rows, 'blue', '1/8', lookup), undefined);
  });
});
