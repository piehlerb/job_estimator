import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { ActualDaySchedule, Costs, Laborer, Pricing } from '../types/index.js';
import {
  calculateActualCosts,
  calculateJobOutputs,
  getActualCrewHours,
  getActualDayDurationHours,
  getActualLaborerHours,
} from './calculations.js';

const schedule: ActualDaySchedule[] = [
  { day: 1, hours: 8, laborerIds: [] },
];

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
  moistureMitigationCostPerGal: 130,
  moistureMitigationSpreadRate: 100,
  createdAt: '2026-06-12T09:00:00.000Z',
  updatedAt: '2026-06-12T09:00:00.000Z',
};

const pricing: Pricing = {
  id: 'current',
  verticalPricePerSqft: 12,
  antiSlipPricePerSqft: 0,
  abrasionResistancePricePerSqft: 0,
  coatingRemovalPaintPerSqft: 0,
  coatingRemovalEpoxyPerSqft: 0,
  moistureMitigationPerSqft: 3,
  createdAt: '2026-06-12T09:00:00.000Z',
  updatedAt: '2026-06-12T09:00:00.000Z',
};

describe('actual cost calculations', () => {
  test('subtracts quantity-weighted product costs once from actual margin', () => {
    const actuals = calculateActualCosts({
      actualSchedule: schedule, actualBaseCoatGallons: 0, actualTopCoatGallons: 0,
      actualCyclo1Gallons: 0, actualTintOz: 0, actualChipBoxes: 0,
      actualCrackRepairOz: 0, actualMoistureMitigationGallons: 0, chipBoxCost: 0,
      totalPrice: 1500, installDays: 2, installDate: '2026-06-12', travelDistance: 0,
      products: [{ productId: 'p', productName: 'Product', quantity: 2, unitCost: 100, unitPrice: 250 }],
    }, costs, pricing, []);
    assert.equal(actuals.actualTotalCosts, 275); // $200 products + $75 royalty
    assert.equal(actuals.actualMargin, 1225);
    assert.equal(actuals.actualMarginPct, 1225 / 1500 * 100);
  });

  test('includes product profit in estimated and suggested margins without changing floor pricing', () => {
    const inputs = {
      floorFootage: 500, verticalFootage: 0, crackFillFactor: 0, travelDistance: 0,
      installDate: '2026-06-12', installDays: 2, jobHours: 0, totalPrice: 4000,
      includeBasecoatTint: false, includeTopcoatTint: false, antiSlip: false,
      abrasionResistance: false, cyclo1Topcoat: false, coatingRemoval: 'None' as const,
      moistureMitigation: false,
    };
    const system = {
      id: 's', name: 'System', feetPerLb: 10, boxCost: 100, baseSpread: 200,
      baseCoats: 1, topSpread: 200, topCoats: 1, cyclo1Spread: 200, cyclo1Coats: 0,
      createdAt: '', updatedAt: '',
    };
    const base = calculateJobOutputs(inputs, system, costs, [], pricing);
    const products = [{ productId: 'p', productName: 'Product', quantity: 2, unitCost: 100, unitPrice: 250 }];
    const result = calculateJobOutputs({ ...inputs, products }, system, costs, [], pricing);
    assert.equal(result.totalCosts, base.totalCosts + 200);
    assert.equal(result.jobMargin, base.jobMargin - 200);
    assert.equal(result.marginPerDay, result.jobMargin / 2);
    assert.equal(result.suggestedFloorPrice, base.suggestedFloorPrice);
    assert.equal(result.suggestedTotal, base.suggestedTotal + 500);
    assert.equal(result.suggestedMargin, base.suggestedMargin + 300);
    const withRevenue = calculateJobOutputs({ ...inputs, totalPrice: 4500, products }, system, costs, [], pricing);
    assert.equal(withRevenue.jobMargin, base.jobMargin + 300 - 25); // Existing 5% royalty on added revenue.
    assert.deepEqual(calculateJobOutputs({ ...inputs, products: [] }, system, costs, [], pricing), base);
  });

  test('includes actual moisture mitigation gallons in actual total costs', () => {
    const actuals = calculateActualCosts(
      {
        actualSchedule: schedule,
        actualBaseCoatGallons: 0,
        actualTopCoatGallons: 0,
        actualCyclo1Gallons: 0,
        actualTintOz: 0,
        actualChipBoxes: 0,
        actualCrackRepairOz: 0,
        actualMoistureMitigationGallons: 3,
        chipBoxCost: 0,
        totalPrice: 0,
        installDays: 1,
        installDate: '2026-06-12',
        travelDistance: 0,
        disableGasHeater: true,
      },
      costs,
      pricing,
      []
    );

    assert.equal(actuals.actualMoistureMitigationCost, 390);
    assert.equal(actuals.actualTotalCosts, 390);
  });
});

const laborers: Laborer[] = [
  { id: 'a', name: 'Ann', fullyLoadedRate: 30, isActive: true, createdAt: '', updatedAt: '' },
  { id: 'b', name: 'Bob', fullyLoadedRate: 20, isActive: true, createdAt: '', updatedAt: '' },
];

function actualsFor(actualSchedule: ActualDaySchedule[], installDays: number, travelDistance = 0) {
  return calculateActualCosts(
    {
      actualSchedule,
      actualBaseCoatGallons: 0,
      actualTopCoatGallons: 0,
      actualCyclo1Gallons: 0,
      actualTintOz: 0,
      actualChipBoxes: 0,
      actualCrackRepairOz: 0,
      actualMoistureMitigationGallons: 0,
      chipBoxCost: 0,
      totalPrice: 0,
      installDays,
      installDate: '2026-06-12',
      travelDistance,
      disableGasHeater: true,
    },
    costs,
    pricing,
    laborers
  );
}

describe('per-laborer actual hours', () => {
  test('falls back to the day hours when a laborer has no override', () => {
    const day: ActualDaySchedule = { day: 1, hours: 8, laborerIds: ['a', 'b'], laborerHours: [{ laborerId: 'b', hours: 6 }] };
    assert.equal(getActualLaborerHours(day, 'a'), 8);
    assert.equal(getActualLaborerHours(day, 'b'), 6);
    assert.equal(getActualCrewHours([day]), 14);
  });

  test('tolerates a malformed laborerHours value instead of throwing', () => {
    const day = { day: 1, hours: 8, laborerIds: ['a'], laborerHours: { a: 4 } } as unknown as ActualDaySchedule;
    assert.equal(getActualLaborerHours(day, 'a'), 8);
    assert.equal(getActualCrewHours([day]), 8);
  });

  test('day duration follows the longest shift on site', () => {
    assert.equal(getActualDayDurationHours({ day: 1, hours: 8, laborerIds: [] }), 8);
    assert.equal(
      getActualDayDurationHours({ day: 1, hours: 8, laborerIds: ['a', 'b'], laborerHours: [{ laborerId: 'a', hours: 10 }] }),
      10
    );
    assert.equal(
      getActualDayDurationHours({ day: 1, hours: 8, laborerIds: ['a', 'b'], laborerHours: [{ laborerId: 'a', hours: 4 }, { laborerId: 'b', hours: 5 }] }),
      5
    );
  });

  test('labor cost charges each laborer their own hours', () => {
    const actuals = actualsFor([{ day: 1, hours: 8, laborerIds: ['a', 'b'], laborerHours: [{ laborerId: 'b', hours: 6 }] }], 1);
    // Ann 8h @ $30 + Bob 6h @ $20
    assert.equal(actuals.actualLaborCost, 360);
    assert.equal(actuals.actualTotalHours, 8);
  });

  test('unchanged behaviour when no overrides are present', () => {
    const actuals = actualsFor([{ day: 1, hours: 8, laborerIds: ['a', 'b'] }], 1);
    assert.equal(actuals.actualLaborCost, 400);
    assert.equal(actuals.actualTotalHours, 8);
  });
});

describe('actual day count independent of the plan', () => {
  test('travel gas follows the actual number of days, not the planned days', () => {
    const gasCosts: Costs = { ...costs, gasCost: 4 };
    const run = (actualSchedule: ActualDaySchedule[], installDays: number) =>
      calculateActualCosts(
        {
          actualSchedule,
          actualBaseCoatGallons: 0,
          actualTopCoatGallons: 0,
          actualCyclo1Gallons: 0,
          actualTintOz: 0,
          actualChipBoxes: 0,
          actualCrackRepairOz: 0,
          actualMoistureMitigationGallons: 0,
          chipBoxCost: 0,
          totalPrice: 0,
          installDays,
          installDate: '2026-06-12',
          travelDistance: 25,
          disableGasHeater: true,
        },
        gasCosts,
        pricing,
        laborers
      );

    // 50 round-trip miles / 10 mpg * $4 = $20 per trip, one trip per day + one extra
    const planned3ActualOne = run([{ day: 1, hours: 8, laborerIds: [] }], 3);
    assert.equal(planned3ActualOne.actualGasTravelCost, 40);

    const planned1ActualTwo = run(
      [
        { day: 1, hours: 8, laborerIds: [] },
        { day: 2, hours: 4, laborerIds: [] },
      ],
      1
    );
    assert.equal(planned1ActualTwo.actualGasTravelCost, 60);
    assert.equal(planned1ActualTwo.actualTotalHours, 12);
  });
});
