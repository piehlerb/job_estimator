import type {
  ChipInventory,
  CoatingInventory,
  InventoryActualResolvedLine,
  InventoryActualsApplied,
  InventoryTarget,
  JobMaterialAllocation,
  MiscInventory,
  TintInventory,
} from '../types/index.js';
import { coatingSkuKey, coatingSkuLabel, findCoatingSku } from './coatingSkus.js';
import { resolveJobMaterials } from './materialAllocation.js';
import { normalizeChipBlendName } from './syncHelpers.js';

// Re-exported for existing importers; the type now lives in types/index.ts
// because resolved lines are persisted (and synced) data.
export type { InventoryTarget } from '../types/index.js';

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
  materialAllocation?: JobMaterialAllocation;
}

export interface InventoryActualsUpdateSource extends InventoryActualsSource {
  inventoryActualsApplied?: InventoryActualsApplied;
  appliedAt?: string;
}

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
  coatingInventory: CoatingInventory[];
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

/**
 * Resolve a source's actual quantities into complete inventory deduction
 * lines, honoring the job's material allocation override via the shared
 * resolver. The lines are persisted on the snapshot (resolvedLines) and are
 * authoritative for later reversal.
 */
export function buildResolvedLines(
  source: InventoryActualsSource
): { lines: InventoryActualResolvedLine[]; warnings: string[] } {
  const lines: InventoryActualResolvedLine[] = [];
  const hasTint = Boolean(source.includeBasecoatTint || source.includeTopcoatTint);

  const resolved = resolveJobMaterials({
    baseGallons: numeric(source.actualBaseCoatGallons) ?? 0,
    topGallons: numeric(source.actualTopCoatGallons) ?? 0,
    baseColor: source.baseColor,
    tintColor: source.tintColor,
    includeBasecoatTint: source.includeBasecoatTint,
    includeTopcoatTint: source.includeTopcoatTint,
    override: source.materialAllocation,
  });

  const actualChipBoxes = numeric(source.actualChipBoxes);
  if (source.chipBlend && actualChipBoxes !== undefined) {
    const blend = normalizeChipBlendName(source.chipBlend);
    lines.push({
      key: `chip:${blend}`,
      label: `${blend} Chips`,
      unit: 'lbs',
      amount: actualChipBoxes * 40,
      target: { kind: 'chip', blend },
    });
  }

  for (const line of resolved.coating) {
    lines.push({
      key: line.key,
      label: line.label,
      unit: 'gal',
      amount: line.gallons,
      target: { kind: 'coating', part: line.part, variant: line.variant, color: line.color },
    });
  }

  // The user enters ONE combined actual tint number; distribute it across the
  // planned tint lines proportionally to their planned oz.
  const actualTintOz = numeric(source.actualTintOz);
  if (actualTintOz !== undefined) {
    const plannedTintOz = resolved.tint.reduce((sum, line) => sum + line.oz, 0);
    if (resolved.tint.length > 0 && plannedTintOz > 0) {
      for (const line of resolved.tint) {
        lines.push({
          key: line.key,
          label: line.label,
          unit: 'oz',
          amount: actualTintOz * (line.oz / plannedTintOz),
          target: { kind: 'tint', color: line.color },
        });
      }
    } else if (hasTint && source.tintColor) {
      // Legacy fallback: the resolver produced no tint lines (e.g. actual
      // gallons are 0) but tint applies — deduct everything from the job's
      // tint color, exactly like the legacy derivation.
      lines.push({
        key: `tint:${source.tintColor}`,
        label: `${source.tintColor} Tint`,
        unit: 'oz',
        amount: actualTintOz,
        target: { kind: 'tint', color: source.tintColor },
      });
    }
  }

  const actualCrackRepairOz = numeric(source.actualCrackRepairOz);
  if (actualCrackRepairOz !== undefined) {
    lines.push({
      key: 'misc:crackRepair',
      label: 'Crack Repair',
      unit: 'gal',
      amount: actualCrackRepairOz / 128,
      target: { kind: 'misc', field: 'crackRepair' },
    });
  }

  const actualMoistureMitigationGallons = numeric(source.actualMoistureMitigationGallons);
  if (actualMoistureMitigationGallons !== undefined) {
    lines.push({
      key: 'misc:moistureMitigation',
      label: 'Moisture Mitigation',
      unit: 'gal',
      amount: actualMoistureMitigationGallons,
      target: { kind: 'misc', field: 'moistureMitigation' },
    });
  }

  return { lines, warnings: resolved.warnings };
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

  const { lines } = buildResolvedLines(source);
  if (lines.length > 0) snapshot.resolvedLines = lines;

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

  // Snapshots that carry resolved lines are authoritative — add them verbatim
  // instead of re-deriving buckets (allocations may have changed since).
  if (snapshot.resolvedLines) {
    for (const line of snapshot.resolvedLines) {
      addAmount(map, {
        key: line.key,
        productName: line.label,
        unit: line.unit,
        usedDelta: line.amount * multiplier,
        target: line.target,
      });
    }
    return;
  }

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
      addAmount(map, {
        key: coatingSkuKey('baseA'),
        productName: coatingSkuLabel({ part: 'baseA' }),
        unit: 'gal',
        usedDelta: (snapshot.actualBaseCoatGallons / 3) * multiplier,
        target: { kind: 'coating', part: 'baseA' },
      });
      addAmount(map, {
        key: coatingSkuKey('baseB', 'Normal', baseColor),
        productName: coatingSkuLabel({ part: 'baseB', variant: 'Normal', color: baseColor }),
        unit: 'gal',
        usedDelta: ((snapshot.actualBaseCoatGallons * 2) / 3) * multiplier,
        target: { kind: 'coating', part: 'baseB', variant: 'Normal', color: baseColor },
      });
    } else {
      addAmount(map, {
        key: coatingSkuKey('baseA'),
        productName: coatingSkuLabel({ part: 'baseA' }),
        unit: 'gal',
        usedDelta: snapshot.actualBaseCoatGallons * multiplier,
        target: { kind: 'coating', part: 'baseA' },
        warning: 'No matching Base B inventory bucket exists for this base color.',
      });
    }
  }

  if (snapshot.actualTopCoatGallons) {
    addAmount(map, {
      key: coatingSkuKey('topA', 'Original'),
      productName: coatingSkuLabel({ part: 'topA', variant: 'Original' }),
      unit: 'gal',
      usedDelta: (snapshot.actualTopCoatGallons / 2) * multiplier,
      target: { kind: 'coating', part: 'topA', variant: 'Original' },
    });
    addAmount(map, {
      key: coatingSkuKey('topB', 'Original'),
      productName: coatingSkuLabel({ part: 'topB', variant: 'Original' }),
      unit: 'gal',
      usedDelta: (snapshot.actualTopCoatGallons / 2) * multiplier,
      target: { kind: 'coating', part: 'topB', variant: 'Original' },
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
  const deltas = buildInventoryActualDeltaRows(snapshot, source.inventoryActualsApplied);

  // Surface resolver warnings (invalid shares, unknown base color, …) on the
  // review rows. They are job-level, so attach them to the first coating row.
  const { warnings } = buildResolvedLines(source);
  if (warnings.length > 0) {
    const coatingRow = deltas.find((row) => row.target.kind === 'coating');
    if (coatingRow) {
      coatingRow.warning = combineWarnings(coatingRow.warning, warnings.join(' '));
    }
  }

  return { snapshot, deltas };
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
    } else if (target.kind === 'coating') {
      const sku = findCoatingSku(inputs.coatingInventory, target.part, target.variant, target.color);
      currentValue = sku?.gallons ?? 0;
      inventoryId = sku?.id;
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
