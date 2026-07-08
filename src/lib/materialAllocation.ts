/**
 * Shared material allocation resolver — the single source of truth for how a
 * job's base/top gallons split into coating SKUs (part + variant + color) and
 * tint lines. Used by Inventory commitments and the Job Summary modal (and,
 * in Phase 4, by inventory actuals).
 *
 * Pure module: no db imports, only types + SKU helpers.
 *
 * Legacy parity: a job with no override must produce exactly the numbers the
 * old hard-coded math did (Base A = 1/3, Base B Normal <color> = 2/3,
 * Top A/B Original = 50/50, tint = gallons × 128 × 0.1).
 */

import type {
  BaseCoatAllocation,
  CoatingPart,
  JobMaterialAllocation,
  TopcoatAllocation,
} from '../types/index.js';
import { coatingSkuKey, coatingSkuLabel } from './coatingSkus.js';

/** Base kit ratio: 1 part A : 2 parts B. */
export const BASE_A_FRACTION = 1 / 3;
/** Top kit ratio: 1:1 A:B. */
export const TOP_A_FRACTION = 0.5;
/** Tint ounces per gallon of coating: 128 × 0.1 — matches calculations.ts tint formula. */
export const TINT_OZ_PER_GAL = 12.8;

export interface MaterialAllocationInput {
  baseGallons: number;
  topGallons: number;
  baseColor?: string;
  tintColor?: string; // job-level tint color
  includeBasecoatTint?: boolean;
  includeTopcoatTint?: boolean;
  override?: JobMaterialAllocation;
}

export interface ResolvedCoatingLine {
  key: string; // coatingSkuKey(part, variant, color)
  part: CoatingPart;
  variant?: string;
  color?: string;
  gallons: number;
  label: string;
}

export interface ResolvedTintLine {
  key: string; // `tint:<color>`
  color: string;
  oz: number;
  label: string;
}

export interface ResolvedMaterials {
  coating: ResolvedCoatingLine[];
  tint: ResolvedTintLine[];
  warnings: string[];
}

/**
 * Shares are valid when they sum to 1 (±0.001) and every share is > 0.
 */
export function sharesValid(components: Array<{ share: number }>): boolean {
  if (components.length === 0) return false;
  if (components.some((c) => !(c.share > 0))) return false;
  const total = components.reduce((sum, c) => sum + c.share, 0);
  return Math.abs(total - 1) <= 0.001;
}

/**
 * Default Base B components for a finish color. Returns null when the color
 * is unknown (or undefined) — callers then only count the Base A portion.
 */
export function defaultBaseComponents(baseColor: string | undefined): BaseCoatAllocation[] | null {
  switch (baseColor) {
    case 'Grey':
      return [{ variant: 'Normal', color: 'Grey', share: 1 }];
    case 'Tan':
      return [{ variant: 'Normal', color: 'Tan', share: 1 }];
    case 'Clear':
      return [{ variant: 'Normal', color: 'Clear', share: 1 }];
    case 'Mocha':
      return [
        { variant: 'Normal', color: 'Grey', share: 0.5 },
        { variant: 'Normal', color: 'Tan', share: 0.5 },
      ];
    default:
      return null;
  }
}

/**
 * Normalize a component list's shares so they sum to 1. Returns null when the
 * total share is not positive (caller should fall back to defaults).
 */
function normalizeShares<T extends { share: number }>(components: T[]): T[] | null {
  const total = components.reduce((sum, c) => sum + c.share, 0);
  if (!(total > 0)) return null;
  return components.map((c) => ({ ...c, share: c.share / total }));
}

/**
 * Resolve a job's coating and tint requirements into SKU-level lines.
 * Lines are merged by key, near-zero lines dropped, and sorted by key.
 */
export function resolveJobMaterials(input: MaterialAllocationInput): ResolvedMaterials {
  const warnings: string[] = [];
  const coatingByKey = new Map<string, ResolvedCoatingLine>();
  const tintByKey = new Map<string, ResolvedTintLine>();

  const addCoating = (part: CoatingPart, variant: string | undefined, color: string | undefined, gallons: number) => {
    const key = coatingSkuKey(part, variant, color);
    const existing = coatingByKey.get(key);
    if (existing) {
      existing.gallons += gallons;
    } else {
      coatingByKey.set(key, {
        key,
        part,
        variant,
        color,
        gallons,
        label: coatingSkuLabel({ part, variant, color }),
      });
    }
  };

  const addTint = (color: string, oz: number) => {
    const key = `tint:${color}`;
    const existing = tintByKey.get(key);
    if (existing) {
      existing.oz += oz;
    } else {
      tintByKey.set(key, { key, color, oz, label: `${color} Tint` });
    }
  };

  // ── Topcoat ────────────────────────────────────────────────────────────────
  if (input.topGallons > 0) {
    let flavors: TopcoatAllocation[] =
      input.override?.top?.length ? input.override.top : [{ variant: 'Original', share: 1 }];
    if (input.override?.top?.length && !sharesValid(flavors)) {
      warnings.push('Topcoat allocation shares do not sum to 100%.');
      flavors = normalizeShares(flavors) ?? [{ variant: 'Original', share: 1 }];
    }
    // B portion computed as remainder so a default job matches the legacy
    // hard-coded math bit-for-bit (no floating-point drift from 1 − fraction).
    const topAPortion = input.topGallons * TOP_A_FRACTION;
    const topBPortion = input.topGallons - topAPortion;
    for (const flavor of flavors) {
      addCoating('topA', flavor.variant, undefined, topAPortion * flavor.share);
      addCoating('topB', flavor.variant, undefined, topBPortion * flavor.share);
    }
  }

  // ── Basecoat ───────────────────────────────────────────────────────────────
  let baseComponents: BaseCoatAllocation[] | null = null;
  if (input.baseGallons > 0) {
    if (input.override?.base?.length) {
      baseComponents = input.override.base;
      if (!sharesValid(baseComponents)) {
        warnings.push('Base coat allocation shares do not sum to 100%.');
        baseComponents = normalizeShares(baseComponents) ?? defaultBaseComponents(input.baseColor);
      }
    } else {
      baseComponents = defaultBaseComponents(input.baseColor);
    }

    // Base A is always drawn regardless of how the B portion resolves.
    // B portion computed as remainder for bit-for-bit legacy parity.
    const baseAPortion = input.baseGallons * BASE_A_FRACTION;
    const baseBPortion = input.baseGallons - baseAPortion;
    addCoating('baseA', undefined, undefined, baseAPortion);

    if (baseComponents) {
      for (const component of baseComponents) {
        addCoating('baseB', component.variant, component.color, baseBPortion * component.share);
      }
    } else {
      warnings.push(
        `No Base B allocation for base color "${input.baseColor ?? ''}" — Base B portion is not counted.`
      );
    }
  }

  // ── Tint ───────────────────────────────────────────────────────────────────
  // Top tint (legacy formula, unchanged by overrides).
  if (input.includeTopcoatTint && input.tintColor && input.topGallons > 0) {
    addTint(input.tintColor, input.topGallons * TINT_OZ_PER_GAL);
  }

  // Base tint: per-component mode when any component carries an explicit
  // tintColor (only possible via override); otherwise legacy job-level mode.
  const hasPerComponentTint = !!baseComponents?.some((c) => c.tintColor);
  if (hasPerComponentTint && baseComponents) {
    for (const component of baseComponents) {
      if (component.color !== 'Clear') continue;
      const tintColor = component.tintColor ?? input.tintColor;
      if (!tintColor) continue;
      addTint(tintColor, input.baseGallons * component.share * TINT_OZ_PER_GAL);
    }
  } else if (input.includeBasecoatTint && input.tintColor && input.baseGallons > 0) {
    // Legacy mode: tintNeeded = baseGallons × 12.8 regardless of base color —
    // parity with existing jobs matters more than gating on Clear components.
    addTint(input.tintColor, input.baseGallons * TINT_OZ_PER_GAL);
  }

  const coating = [...coatingByKey.values()]
    .filter((line) => Math.abs(line.gallons) >= 1e-6)
    .sort((a, b) => a.key.localeCompare(b.key));
  const tint = [...tintByKey.values()]
    .filter((line) => Math.abs(line.oz) >= 1e-6)
    .sort((a, b) => a.key.localeCompare(b.key));

  return { coating, tint, warnings };
}
