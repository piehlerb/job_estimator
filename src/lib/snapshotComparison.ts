import { ChipSystem, Costs } from '../types';

export interface SnapshotChanges {
  hasChanges: boolean;
  systemChanges: Array<{ field: string; oldValue: number; newValue: number }>;
  costChanges: Array<{ field: string; oldValue: number; newValue: number }>;
}

const SYSTEM_FIELDS: Array<keyof ChipSystem> = [
  'feetPerLb',
  'boxCost',
  'baseSpread',
  'topSpread',
  'cyclo1Spread',
];

const COST_FIELDS: Array<keyof Costs> = [
  'baseCostPerGal',
  'topCostPerGal',
  'crackFillCost',
  'gasCost',
  'consumablesCost',
  'cyclo1CostPerGal',
  'tintCostPerQuart',
  'antiSlipCostPerGal',
  'abrasionResistanceCostPerGal',
];

const FIELD_LABELS: Record<string, string> = {
  feetPerLb: 'Feet per Lb',
  boxCost: 'Box Cost',
  baseSpread: 'Base Spread',
  topSpread: 'Top Spread',
  cyclo1Spread: 'Cyclo1 Spread',
  baseCostPerGal: 'Base Cost/Gal',
  topCostPerGal: 'Top Cost/Gal',
  crackFillCost: 'Crack Fill Cost',
  gasCost: 'Gas Cost',
  consumablesCost: 'Consumables Cost',
  cyclo1CostPerGal: 'Cyclo1 Cost/Gal',
  tintCostPerQuart: 'Tint Cost/Quart',
  antiSlipCostPerGal: 'Anti-Slip Cost/Gal',
  abrasionResistanceCostPerGal: 'Abrasion Resistance Cost/Gal',
};

export function getFieldLabel(field: string): string {
  return FIELD_LABELS[field] || field;
}

export function compareSnapshots(
  snapshotSystem: ChipSystem | null,
  currentSystem: ChipSystem | null,
  snapshotCosts: Costs | null,
  currentCosts: Costs | null
): SnapshotChanges {
  const systemChanges: Array<{ field: string; oldValue: number; newValue: number }> = [];
  const costChanges: Array<{ field: string; oldValue: number; newValue: number }> = [];

  // Compare system fields
  if (snapshotSystem && currentSystem) {
    SYSTEM_FIELDS.forEach((field) => {
      const oldValue = snapshotSystem[field] as number;
      const newValue = currentSystem[field] as number;
      // Only compare if both values exist and are numbers
      if (typeof oldValue === 'number' && typeof newValue === 'number' && oldValue !== newValue) {
        systemChanges.push({ field, oldValue, newValue });
      }
    });
  }

  // Compare cost fields
  if (snapshotCosts && currentCosts) {
    COST_FIELDS.forEach((field) => {
      const oldValue = snapshotCosts[field] as number;
      const newValue = currentCosts[field] as number;
      // Only compare if both values exist and are numbers
      // Skip comparison if either is undefined (new field added later)
      if (typeof oldValue === 'number' && typeof newValue === 'number' && oldValue !== newValue) {
        costChanges.push({ field, oldValue, newValue });
      }
    });
  }

  return {
    hasChanges: systemChanges.length > 0 || costChanges.length > 0,
    systemChanges,
    costChanges,
  };
}
