import type {
  BaseCoatInventory,
  ChipInventory,
  InventoryActualsApplied,
  MiscInventory,
  TintInventory,
  TopCoatInventory,
} from '../types/index.js';
import { normalizeChipBlendName } from './syncHelpers.js';

export interface InventoryActualsSource {
  actualBaseCoatGallons?: number;
  actualTopCoatGallons?: number;
  actualCyclo1Gallons?: number;
  actualTintOz?: number;
  actualChipBoxes?: number;
  actualCrackRepairOz?: number;
  actualMoistureMitigationGallons?: number;
  chipBlend?: string;
  baseColor?: string;
  tintColor?: string;
  includeBasecoatTint?: boolean;
  includeTopcoatTint?: boolean;
}

export interface InventoryActualsUpdateSource extends InventoryActualsSource {
  inventoryActualsApplied?: InventoryActualsApplied;
  appliedAt?: string;
}

export type InventoryTarget =
  | { kind: 'chip'; blend: string }
  | { kind: 'base'; field: keyof Pick<BaseCoatInventory, 'baseA' | 'baseBGrey' | 'baseBTan' | 'baseBClear'> }
  | { kind: 'top'; field: keyof Pick<TopCoatInventory, 'topA' | 'topB'> }
  | { kind: 'tint'; color: string }
  | { kind: 'misc'; field: keyof Pick<MiscInventory, 'crackRepair' | 'moistureMitigation'> };

export interface InventoryActualDeltaRow {
  key: string;
  productName: string;
  unit: 'lbs' | 'gal' | 'oz';
  usedDelta: number;
  target: InventoryTarget;
  warning?: string;
}

export interface InventoryReviewRow extends InventoryActualDeltaRow {
  currentValue: number;
  newValue: number;
  isMissingInventory: boolean;
  inventoryId?: string;
}

export interface InventoryReviewInputs {
  deltas: InventoryActualDeltaRow[];
  chipInventory: ChipInventory[];
  tintInventory: TintInventory[];
  topCoatInventory: TopCoatInventory | null;
  baseCoatInventory: BaseCoatInventory | null;
  miscInventory: MiscInventory | null;
}

const ZERO_EPSILON = 0.000001;
const MISSING_INVENTORY_WARNING = 'Missing inventory record; current value is assumed to be 0.';

function numeric(value: number | undefined): number | undefined {
  return value !== undefined && value > 0 && Number.isFinite(value) ? value : undefined;
}

function combineWarnings(...warnings: Array<string | undefined>): string | undefined {
  return warnings.filter(Boolean).join(' ') || undefined;
}

export function buildInventoryActualsSnapshot(
  source: InventoryActualsSource,
  appliedAt: string
): InventoryActualsApplied {
  const hasTint = Boolean(source.includeBasecoatTint || source.includeTopcoatTint);
  const snapshot: InventoryActualsApplied = { appliedAt };

  const actualBaseCoatGallons = numeric(source.actualBaseCoatGallons);
  if (actualBaseCoatGallons !== undefined) snapshot.actualBaseCoatGallons = actualBaseCoatGallons;

  const actualTopCoatGallons = numeric(source.actualTopCoatGallons);
  if (actualTopCoatGallons !== undefined) snapshot.actualTopCoatGallons = actualTopCoatGallons;

  const actualCyclo1Gallons = numeric(source.actualCyclo1Gallons);
  if (actualCyclo1Gallons !== undefined) snapshot.actualCyclo1Gallons = actualCyclo1Gallons;

  const actualTintOz = numeric(source.actualTintOz);
  if (actualTintOz !== undefined) snapshot.actualTintOz = actualTintOz;

  const actualChipBoxes = numeric(source.actualChipBoxes);
  if (actualChipBoxes !== undefined) snapshot.actualChipBoxes = actualChipBoxes;

  const actualCrackRepairOz = numeric(source.actualCrackRepairOz);
  if (actualCrackRepairOz !== undefined) snapshot.actualCrackRepairOz = actualCrackRepairOz;

  const actualMoistureMitigationGallons = numeric(source.actualMoistureMitigationGallons);
  if (actualMoistureMitigationGallons !== undefined) {
    snapshot.actualMoistureMitigationGallons = actualMoistureMitigationGallons;
  }

  if (source.chipBlend) snapshot.chipBlend = normalizeChipBlendName(source.chipBlend);
  if (source.baseColor) snapshot.baseColor = source.baseColor;
  if (hasTint && source.tintColor) snapshot.tintColor = source.tintColor;

  return snapshot;
}

function addAmount(map: Map<string, InventoryActualDeltaRow>, row: InventoryActualDeltaRow): void {
  if (Math.abs(row.usedDelta) < ZERO_EPSILON) return;

  const existing = map.get(row.key);
  if (existing) {
    existing.usedDelta += row.usedDelta;
    if (!existing.warning && row.warning) existing.warning = row.warning;
    return;
  }

  map.set(row.key, { ...row });
}

function addSnapshotAmounts(
  map: Map<string, InventoryActualDeltaRow>,
  snapshot: InventoryActualsApplied | undefined,
  multiplier: 1 | -1
): void {
  if (!snapshot) return;

  if (snapshot.chipBlend && snapshot.actualChipBoxes) {
    addAmount(map, {
      key: `chip:${snapshot.chipBlend}`,
      productName: `${snapshot.chipBlend} Chips`,
      unit: 'lbs',
      usedDelta: snapshot.actualChipBoxes * 40 * multiplier,
      target: { kind: 'chip', blend: snapshot.chipBlend },
    });
  }

  if (snapshot.actualBaseCoatGallons) {
    const baseColor = snapshot.baseColor;
    if (baseColor === 'Grey' || baseColor === 'Tan' || baseColor === 'Clear') {
      const field = baseColor === 'Grey' ? 'baseBGrey' : baseColor === 'Tan' ? 'baseBTan' : 'baseBClear';
      const label = baseColor === 'Grey' ? 'Base B - Grey' : baseColor === 'Tan' ? 'Base B - Tan' : 'Base B - Clear';

      addAmount(map, {
        key: 'base:baseA',
        productName: 'Base A',
        unit: 'gal',
        usedDelta: (snapshot.actualBaseCoatGallons / 3) * multiplier,
        target: { kind: 'base', field: 'baseA' },
      });
      addAmount(map, {
        key: `base:${field}`,
        productName: label,
        unit: 'gal',
        usedDelta: ((snapshot.actualBaseCoatGallons * 2) / 3) * multiplier,
        target: { kind: 'base', field },
      });
    } else {
      addAmount(map, {
        key: 'base:baseA',
        productName: 'Base A',
        unit: 'gal',
        usedDelta: snapshot.actualBaseCoatGallons * multiplier,
        target: { kind: 'base', field: 'baseA' },
        warning: 'No matching Base B inventory bucket exists for this base color.',
      });
    }
  }

  if (snapshot.actualTopCoatGallons) {
    addAmount(map, {
      key: 'top:topA',
      productName: 'Top A',
      unit: 'gal',
      usedDelta: (snapshot.actualTopCoatGallons / 2) * multiplier,
      target: { kind: 'top', field: 'topA' },
    });
    addAmount(map, {
      key: 'top:topB',
      productName: 'Top B',
      unit: 'gal',
      usedDelta: (snapshot.actualTopCoatGallons / 2) * multiplier,
      target: { kind: 'top', field: 'topB' },
    });
  }

  if (snapshot.tintColor && snapshot.actualTintOz) {
    addAmount(map, {
      key: `tint:${snapshot.tintColor}`,
      productName: `${snapshot.tintColor} Tint`,
      unit: 'oz',
      usedDelta: snapshot.actualTintOz * multiplier,
      target: { kind: 'tint', color: snapshot.tintColor },
    });
  }

  if (snapshot.actualCrackRepairOz) {
    addAmount(map, {
      key: 'misc:crackRepair',
      productName: 'Crack Repair',
      unit: 'gal',
      usedDelta: (snapshot.actualCrackRepairOz / 128) * multiplier,
      target: { kind: 'misc', field: 'crackRepair' },
    });
  }

  if (snapshot.actualMoistureMitigationGallons) {
    addAmount(map, {
      key: 'misc:moistureMitigation',
      productName: 'Moisture Mitigation',
      unit: 'gal',
      usedDelta: snapshot.actualMoistureMitigationGallons * multiplier,
      target: { kind: 'misc', field: 'moistureMitigation' },
    });
  }
}

export function buildInventoryActualDeltaRows(
  current: InventoryActualsApplied,
  baseline: InventoryActualsApplied | undefined
): InventoryActualDeltaRow[] {
  const map = new Map<string, InventoryActualDeltaRow>();
  addSnapshotAmounts(map, baseline, -1);
  addSnapshotAmounts(map, current, 1);

  return Array.from(map.values())
    .map((row) => ({ ...row, usedDelta: Math.abs(row.usedDelta) < ZERO_EPSILON ? 0 : row.usedDelta }))
    .filter((row) => Math.abs(row.usedDelta) >= ZERO_EPSILON)
    .sort((a, b) => a.key.localeCompare(b.key));
}

export function buildInventoryActualsUpdate(
  source: InventoryActualsUpdateSource,
  appliedAt = source.appliedAt ?? new Date().toISOString()
): { snapshot: InventoryActualsApplied; deltas: InventoryActualDeltaRow[] } {
  const snapshot = buildInventoryActualsSnapshot(source, appliedAt);

  return {
    snapshot,
    deltas: buildInventoryActualDeltaRows(snapshot, source.inventoryActualsApplied),
  };
}

export function hasInventoryActualsDelta(
  current: InventoryActualsApplied,
  baseline: InventoryActualsApplied | undefined
): boolean {
  return buildInventoryActualDeltaRows(current, baseline).length > 0;
}

export function buildInventoryReviewRows(inputs: InventoryReviewInputs): InventoryReviewRow[] {
  return inputs.deltas.map((delta) => {
    const target = delta.target;
    let currentValue = 0;
    let inventoryId: string | undefined;

    if (target.kind === 'chip') {
      const item = inputs.chipInventory.find((inv) => normalizeChipBlendName(inv.blend) === target.blend);
      currentValue = item?.pounds ?? 0;
      inventoryId = item?.id;
    } else if (target.kind === 'tint') {
      const item = inputs.tintInventory.find((inv) => inv.color === target.color);
      currentValue = item?.ounces ?? 0;
      inventoryId = item?.id;
    } else if (target.kind === 'top') {
      currentValue = inputs.topCoatInventory?.[target.field] ?? 0;
      inventoryId = inputs.topCoatInventory?.id;
    } else if (target.kind === 'base') {
      currentValue = inputs.baseCoatInventory?.[target.field] ?? 0;
      inventoryId = inputs.baseCoatInventory?.id;
    } else {
      currentValue = inputs.miscInventory?.[target.field] ?? 0;
      inventoryId = inputs.miscInventory?.id;
    }

    const isMissingInventory = inventoryId === undefined;

    return {
      ...delta,
      currentValue,
      newValue: currentValue - delta.usedDelta,
      isMissingInventory,
      inventoryId,
      warning: combineWarnings(delta.warning, isMissingInventory ? MISSING_INVENTORY_WARNING : undefined),
    };
  });
}
