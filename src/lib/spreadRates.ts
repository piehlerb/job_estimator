/**
 * Spread rate tracking: compares the sqft-per-gallon a job was estimated at with
 * what the crew actually got, per surface (floor / vertical) and coat (base / top).
 *
 * Rates are per coat, the same unit as ChipSystem.baseSpread / topSpread, so
 * they can be compared directly with (and fed back into) the system settings.
 *
 * Pure module: no db imports.
 */

import type { Job, JobCalculation, SpreadRates } from '../types/index.js';
import { systemCoats } from './calculations.js';

export type SpreadSurface = keyof SpreadRates;

export const SPREAD_SURFACES: readonly SpreadSurface[] = ['baseFloor', 'baseVertical', 'topFloor', 'topVertical'];

export const SPREAD_SURFACE_LABELS: Record<SpreadSurface, string> = {
  baseFloor: 'Base Floor',
  baseVertical: 'Base Vertical',
  topFloor: 'Top Floor',
  topVertical: 'Top Vertical',
};

type ActualSplitFields = Pick<
  Job,
  | 'verticalFootage'
  | 'actualBaseCoatGallons'
  | 'actualTopCoatGallons'
  | 'actualBaseCoatFloorGallons'
  | 'actualBaseCoatVerticalGallons'
  | 'actualTopCoatFloorGallons'
  | 'actualTopCoatVerticalGallons'
>;

function positive(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

/**
 * Actual gallons used on each surface, where known. A job with no vertical
 * footage put everything on the floor, so its total counts as floor usage even
 * when no split was recorded.
 */
export function actualSurfaceGallons(job: ActualSplitFields): Partial<Record<SpreadSurface, number>> {
  const floorOnly = !(job.verticalFootage > 0);
  const result: Partial<Record<SpreadSurface, number>> = {};

  const baseFloor = positive(job.actualBaseCoatFloorGallons) ?? (floorOnly ? positive(job.actualBaseCoatGallons) : undefined);
  const topFloor = positive(job.actualTopCoatFloorGallons) ?? (floorOnly ? positive(job.actualTopCoatGallons) : undefined);
  if (baseFloor !== undefined) result.baseFloor = baseFloor;
  if (topFloor !== undefined) result.topFloor = topFloor;
  if (!floorOnly) {
    const baseVertical = positive(job.actualBaseCoatVerticalGallons);
    const topVertical = positive(job.actualTopCoatVerticalGallons);
    if (baseVertical !== undefined) result.baseVertical = baseVertical;
    if (topVertical !== undefined) result.topVertical = topVertical;
  }
  return result;
}

export interface SurfaceSpread {
  /** Area covered counting every coat: sqft × coats */
  coverage: number;
  estGallons: number;
  /** Estimated rate, sqft/gal per coat (after any job override) */
  estRate: number;
  actualGallons?: number;
  /** Actual rate, sqft/gal per coat; absent when no actual was recorded */
  actualRate?: number;
}

export interface JobSpreadRow {
  job: Job;
  systemId: string;
  systemName: string;
  surfaces: Partial<Record<SpreadSurface, SurfaceSpread>>;
  hasActuals: boolean;
}

/** Per-surface estimated vs actual spread for one job. Surfaces with no area are left out. */
export function buildJobSpreadRow(job: Job, calc: JobCalculation): JobSpreadRow {
  const { baseCoats, topCoats } = systemCoats(job.systemSnapshot);
  const actuals = actualSurfaceGallons(job);
  const plan: Record<SpreadSurface, { sqft: number; coats: number; estGallons: number }> = {
    baseFloor: { sqft: job.floorFootage, coats: baseCoats, estGallons: calc.baseFloorGallons },
    baseVertical: { sqft: job.verticalFootage, coats: baseCoats, estGallons: calc.baseVerticalGallons },
    topFloor: { sqft: job.floorFootage, coats: topCoats, estGallons: calc.topFloorGallons },
    topVertical: { sqft: job.verticalFootage, coats: topCoats, estGallons: calc.topVerticalGallons },
  };

  const surfaces: Partial<Record<SpreadSurface, SurfaceSpread>> = {};
  for (const surface of SPREAD_SURFACES) {
    const { sqft, coats, estGallons } = plan[surface];
    const coverage = (sqft > 0 ? sqft : 0) * coats;
    if (!(coverage > 0)) continue;
    const actualGallons = actuals[surface];
    surfaces[surface] = {
      coverage,
      estGallons,
      estRate: calc.spreadRates[surface],
      ...(actualGallons !== undefined ? { actualGallons, actualRate: coverage / actualGallons } : {}),
    };
  }

  return {
    job,
    systemId: job.systemId,
    systemName: job.systemSnapshot?.name || 'Unknown system',
    surfaces,
    hasActuals: SPREAD_SURFACES.some((s) => surfaces[s]?.actualRate !== undefined),
  };
}

export interface SurfaceAggregate {
  jobs: number;
  coverage: number;
  estGallons: number;
  actualGallons: number;
  /** Coverage-weighted estimated rate over the jobs with actuals */
  estRate?: number;
  /** Coverage-weighted actual rate: total coverage / total actual gallons */
  actualRate?: number;
}

export interface SystemSpreadAggregate {
  systemId: string;
  systemName: string;
  jobs: number;
  surfaces: Record<SpreadSurface, SurfaceAggregate>;
}

function emptySurfaceAggregate(): SurfaceAggregate {
  return { jobs: 0, coverage: 0, estGallons: 0, actualGallons: 0 };
}

/**
 * Totals actual usage per chip system and surface. Only surfaces with an actual
 * recorded count, and the estimate side is summed over those same jobs so the
 * two rates compare like with like.
 */
export function aggregateSpreadBySystem(rows: readonly JobSpreadRow[]): SystemSpreadAggregate[] {
  const bySystem = new Map<string, SystemSpreadAggregate>();

  for (const row of rows) {
    if (!row.hasActuals) continue;
    let entry = bySystem.get(row.systemId);
    if (!entry) {
      entry = {
        systemId: row.systemId,
        systemName: row.systemName,
        jobs: 0,
        surfaces: {
          baseFloor: emptySurfaceAggregate(),
          baseVertical: emptySurfaceAggregate(),
          topFloor: emptySurfaceAggregate(),
          topVertical: emptySurfaceAggregate(),
        },
      };
      bySystem.set(row.systemId, entry);
    }
    entry.jobs += 1;
    for (const surface of SPREAD_SURFACES) {
      const spread = row.surfaces[surface];
      if (!spread || spread.actualGallons === undefined) continue;
      const agg = entry.surfaces[surface];
      agg.jobs += 1;
      agg.coverage += spread.coverage;
      agg.estGallons += spread.estGallons;
      agg.actualGallons += spread.actualGallons;
    }
  }

  const result = [...bySystem.values()];
  for (const entry of result) {
    for (const surface of SPREAD_SURFACES) {
      const agg = entry.surfaces[surface];
      if (agg.estGallons > 0) agg.estRate = agg.coverage / agg.estGallons;
      if (agg.actualGallons > 0) agg.actualRate = agg.coverage / agg.actualGallons;
    }
  }
  return result.sort((a, b) => a.systemName.localeCompare(b.systemName));
}

/** Percent the actual rate differs from the estimate; positive = better coverage than planned. */
export function spreadVariancePct(estRate: number | undefined, actualRate: number | undefined): number | undefined {
  if (!(estRate && estRate > 0) || actualRate === undefined) return undefined;
  return ((actualRate - estRate) / estRate) * 100;
}
