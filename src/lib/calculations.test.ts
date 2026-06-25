import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { ActualDaySchedule, Costs, Pricing } from '../types/index.js';
import { calculateActualCosts } from './calculations.js';

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
