import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { ActualDaySchedule, Costs, Pricing } from '../types/index.js';
import { calculateActualCosts, calculateJobOutputs } from './calculations.js';

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
