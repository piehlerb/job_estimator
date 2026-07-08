/**
 * Pure helpers for SKU-level coating inventory (CoatingInventory records).
 * A SKU is identified by part + variant + color.
 * No db imports — safe to use from any layer.
 */

import { CoatingInventory, CoatingPart } from '../types';

/** Coordinates that identify a coating SKU (plus optional display order). */
export interface CoatingSkuCoords {
  part: CoatingPart;
  variant?: string; // 'Original' | 'Slow Cure' for top parts, 'Normal' | 'Extended' for baseB
  color?: string;   // Base B only: 'Grey' | 'Tan' | 'Clear'
  sortOrder?: number;
}

/**
 * Stable string key for a SKU, e.g. 'coating:baseB:Normal:Grey'.
 * Missing variant/color produce empty segments, e.g. 'coating:baseA::'.
 */
export function coatingSkuKey(part: CoatingPart, variant?: string, color?: string): string {
  return `coating:${part}:${variant || ''}:${color || ''}`;
}

/**
 * Deterministic record id for a SKU. Stable across devices so seeding the
 * same SKU everywhere produces the same id and sync upserts merge cleanly.
 * e.g. 'coating-baseB-Normal-Grey', 'coating-baseA'.
 */
export function coatingSkuId(coords: Pick<CoatingSkuCoords, 'part' | 'variant' | 'color'>): string {
  const segments = [coords.part, coords.variant, coords.color]
    .filter((s): s is string => !!s)
    .map((s) => s.replace(/\s+/g, ''));
  return `coating-${segments.join('-')}`;
}

const PART_LABELS: Record<CoatingPart, string> = {
  topA: 'Top A',
  topB: 'Top B',
  baseA: 'Base A',
  baseB: 'Base B',
};

/**
 * Human-readable label for a SKU, e.g. 'Top A – Original', 'Base A',
 * 'Base B – Extended – Grey'.
 */
export function coatingSkuLabel(sku: Pick<CoatingSkuCoords, 'part' | 'variant' | 'color'>): string {
  const parts = [PART_LABELS[sku.part] ?? sku.part];
  if (sku.variant) parts.push(sku.variant);
  if (sku.color) parts.push(sku.color);
  return parts.join(' – ');
}

/**
 * Find the matching non-deleted SKU record in a list.
 * Treats undefined and '' variant/color as equal.
 */
export function findCoatingSku(
  list: CoatingInventory[],
  part: CoatingPart,
  variant?: string,
  color?: string
): CoatingInventory | undefined {
  return list.find(
    (sku) =>
      !sku.deleted &&
      sku.part === part &&
      (sku.variant || '') === (variant || '') &&
      (sku.color || '') === (color || '')
  );
}

/** The six legacy TopCoatInventory/BaseCoatInventory fields mapped to SKU coordinates. */
export const LEGACY_COATING_FIELDS: Record<
  'topA' | 'topB' | 'baseA' | 'baseBGrey' | 'baseBTan' | 'baseBClear',
  CoatingSkuCoords
> = {
  topA: { part: 'topA', variant: 'Original', sortOrder: 10 },
  topB: { part: 'topB', variant: 'Original', sortOrder: 20 },
  baseA: { part: 'baseA', sortOrder: 30 },
  baseBGrey: { part: 'baseB', variant: 'Normal', color: 'Grey', sortOrder: 40 },
  baseBTan: { part: 'baseB', variant: 'Normal', color: 'Tan', sortOrder: 41 },
  baseBClear: { part: 'baseB', variant: 'Normal', color: 'Clear', sortOrder: 42 },
};

/**
 * Default SKU seeds: the six legacy SKUs plus the known extra flavors
 * (Top A/B Slow Cure, Base B Extended in Grey/Tan/Clear).
 * sortOrder groups tables as topA, topB, baseA, baseB.
 */
export const DEFAULT_COATING_SKUS: CoatingSkuCoords[] = [
  { part: 'topA', variant: 'Original', sortOrder: 10 },
  { part: 'topA', variant: 'Slow Cure', sortOrder: 11 },
  { part: 'topB', variant: 'Original', sortOrder: 20 },
  { part: 'topB', variant: 'Slow Cure', sortOrder: 21 },
  { part: 'baseA', sortOrder: 30 },
  { part: 'baseB', variant: 'Normal', color: 'Grey', sortOrder: 40 },
  { part: 'baseB', variant: 'Normal', color: 'Tan', sortOrder: 41 },
  { part: 'baseB', variant: 'Normal', color: 'Clear', sortOrder: 42 },
  { part: 'baseB', variant: 'Extended', color: 'Grey', sortOrder: 43 },
  { part: 'baseB', variant: 'Extended', color: 'Tan', sortOrder: 44 },
  { part: 'baseB', variant: 'Extended', color: 'Clear', sortOrder: 45 },
];
