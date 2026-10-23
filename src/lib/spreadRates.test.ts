import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { ChipSystem, Costs, Job, Pricing } from '../types/index.js';
import {
  calculateJobOutputs,
  cleanSpreadRateOverrides,
  defaultSpreadRates,
  resolveSpreadRates,
} from './calculations.js';
import {
  actualSurfaceGallons,
  aggregateSpreadBySystem,
  buildJobSpreadRow,
  spreadVariancePct,
} from './spreadRates.js';

const costs: Costs = {
  id: 'current',
  baseCostPerGal: 100,
  topCostPerGal: 120,
  crackFillCost: 80,
  gasCost: 0,
  consumablesCost: 0,
  cyclo1CostPerGal: 90,
  tintCostPerQuart: 40,
  antiSlipCostPerGal: 0,
  abrasionResistanceCostPerGal: 0,
  createdAt: '',
  updatedAt: '',
};

const pricing: Pricing = {
  id: 'current',
  verticalPricePerSqft: 12,
  antiSlipPricePerSqft: 0,
  abrasionResistancePricePerSqft: 0,
  coatingRemovalPaintPerSqft: 0,
  coatingRemovalEpoxyPerSqft: 0,
  moistureMitigationPerSqft: 0,
  verticalSpreadUsageMultiplier: 1.25,
  createdAt: '',
  updatedAt: '',
};

const system: ChipSystem = {
  id: 'sys-1', name: 'Full Broadcast', feetPerLb: 10, boxCost: 100,
  baseSpread: 200, baseCoats: 1, topSpread: 100, topCoats: 2,
  cyclo1Spread: 0, cyclo1Coats: 0, createdAt: '', updatedAt: '',
};

const inputs = {
  floorFootage: 400, verticalFootage: 50, crackFillFactor: 0, travelDistance: 0,
  installDate: '2026-06-12', installDays: 1, jobHours: 0, totalPrice: 4000,
  includeBasecoatTint: false, includeTopcoatTint: false, antiSlip: false,
  abrasionResistance: false, cyclo1Topcoat: false, coatingRemoval: 'None' as const,
  moistureMitigation: false,
};

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1', name: 'Job', systemId: system.id, floorFootage: 400, verticalFootage: 50,
    crackFillFactor: 0, travelDistance: 0, installDate: '2026-06-12', installDays: 1,
    jobHours: 0, totalPrice: 4000, status: 'Won', costsSnapshot: costs, systemSnapshot: system,
    laborersSnapshot: [], createdAt: '', updatedAt: '', synced: true,
    ...overrides,
  };
}

describe('spread rate assumptions', () => {
  test('vertical defaults to the floor rate divided by the vertical usage multiplier', () => {
    assert.deepEqual(defaultSpreadRates(system, pricing), {
      baseFloor: 200, baseVertical: 160, topFloor: 100, topVertical: 80,
    });
  });

  test('estimate splits gallons by surface and keeps the legacy totals', () => {
    const calc = calculateJobOutputs(inputs, system, costs, [], pricing);
    assert.equal(calc.baseFloorGallons, 2);
    assert.equal(calc.baseVerticalGallons, 50 / 160);
    assert.equal(calc.topFloorGallons, 8);
    assert.equal(calc.topVerticalGallons, (50 / 80) * 2);
    // Same totals as the old single formula
    assert.ok(Math.abs(calc.baseGallons - (400 / 200 + (50 / 200) * 1.25)) < 1e-9);
    assert.ok(Math.abs(calc.topGallons - (400 / 100 + (50 / 100) * 1.25) * 2) < 1e-9);
  });

  test('job overrides change gallons and therefore cost', () => {
    const base = calculateJobOutputs(inputs, system, costs, [], pricing);
    const overridden = calculateJobOutputs(
      { ...inputs, spreadRateOverrides: { baseFloor: 100, topVertical: 50 } },
      system, costs, [], pricing
    );
    assert.equal(overridden.baseFloorGallons, 4);
    assert.equal(overridden.baseVerticalGallons, base.baseVerticalGallons);
    assert.equal(overridden.topVerticalGallons, 2);
    assert.deepEqual(overridden.spreadRates, { baseFloor: 100, baseVertical: 160, topFloor: 100, topVertical: 50 });
    assert.ok(overridden.baseCost > base.baseCost);
    assert.ok(overridden.totalCosts > base.totalCosts);
  });

  test('blank or non-positive overrides fall back to defaults and are not stored', () => {
    assert.deepEqual(
      resolveSpreadRates(system, pricing, { baseFloor: 0, topFloor: -5, baseVertical: Number.NaN }),
      defaultSpreadRates(system, pricing)
    );
    assert.equal(cleanSpreadRateOverrides({ baseFloor: 0, topFloor: Number.NaN }), undefined);
    assert.deepEqual(cleanSpreadRateOverrides({ baseFloor: 180, topFloor: 0 }), { baseFloor: 180 });
  });
});

describe('actual surface gallons', () => {
  test('uses the recorded split', () => {
    assert.deepEqual(
      actualSurfaceGallons({ verticalFootage: 50, actualBaseCoatFloorGallons: 2.5, actualBaseCoatVerticalGallons: 0.5 }),
      { baseFloor: 2.5, baseVertical: 0.5 }
    );
  });

  test('counts a total as floor usage on a floor-only job', () => {
    assert.deepEqual(
      actualSurfaceGallons({ verticalFootage: 0, actualBaseCoatGallons: 3, actualTopCoatGallons: 4 }),
      { baseFloor: 3, topFloor: 4 }
    );
  });

  test('does not guess a split from a total when there are verticals', () => {
    assert.deepEqual(actualSurfaceGallons({ verticalFootage: 50, actualBaseCoatGallons: 3 }), {});
  });
});

describe('spread rate report', () => {
  test('per-job rates are per coat', () => {
    const job = makeJob({ actualTopCoatFloorGallons: 10, actualTopCoatVerticalGallons: 1 });
    const row = buildJobSpreadRow(job, calculateJobOutputs(inputs, system, costs, [], pricing));
    assert.equal(row.hasActuals, true);
    assert.equal(row.surfaces.topFloor?.actualRate, (400 * 2) / 10);
    assert.equal(row.surfaces.topFloor?.estRate, 100);
    assert.equal(row.surfaces.topVertical?.actualRate, 100);
    assert.equal(row.surfaces.baseFloor?.actualRate, undefined);
  });

  test('aggregates by system, weighting by coverage', () => {
    const calc = calculateJobOutputs({ ...inputs, verticalFootage: 0 }, system, costs, [], pricing);
    const rows = [
      buildJobSpreadRow(makeJob({ id: 'a', verticalFootage: 0, actualBaseCoatGallons: 2 }), calc),
      buildJobSpreadRow(makeJob({ id: 'b', verticalFootage: 0, actualBaseCoatGallons: 3 }), calc),
      buildJobSpreadRow(makeJob({ id: 'c', verticalFootage: 0 }), calc), // no actuals
    ];
    const [agg] = aggregateSpreadBySystem(rows);
    assert.equal(agg.jobs, 2);
    assert.equal(agg.surfaces.baseFloor.jobs, 2);
    assert.equal(agg.surfaces.baseFloor.actualRate, 800 / 5);
    assert.equal(agg.surfaces.baseFloor.estRate, 200);
    assert.equal(agg.surfaces.topFloor.actualRate, undefined);
    assert.equal(spreadVariancePct(agg.surfaces.baseFloor.estRate, agg.surfaces.baseFloor.actualRate), -20);
  });
});
