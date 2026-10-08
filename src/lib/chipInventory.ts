import type { ChipBlend, ChipInventory, ChipSystem, Job } from '../types/index.js';
import { normalizeChipBlendName } from './syncHelpers.js';

/**
 * Chip inventory is tracked per blend AND chip type — the physical chip
 * product (1/4, 1/8, 1/16, Stone, Hybrid, ...). A chip type is not a chip
 * system: "1/4" and "1/4 Outdoor" (double broadcast) are different systems
 * that draw from the same 1/4 stock. Each system names its chip type; systems
 * that use no chip leave it blank.
 *
 * Rows and snapshots written before chip types existed carry a systemId
 * instead; a ChipTypeLookup translates those through the system's chip type.
 * Rows that resolve to no chip type are legacy/unassigned stock.
 */

/** Resolves a chip system id to that system's chip type. */
export type ChipTypeLookup = (systemId: string) => string | undefined;

/** Trim and collapse whitespace; blank becomes undefined. */
export function normalizeChipType(value?: string | null): string | undefined {
  const normalized = value?.trim().replace(/\s+/g, ' ');
  return normalized || undefined;
}

/** Chip types compare case-insensitively ("Stone" = "stone"). */
export function sameChipType(a?: string | null, b?: string | null): boolean {
  const left = normalizeChipType(a);
  const right = normalizeChipType(b);
  return !!left && !!right && left.toLowerCase() === right.toLowerCase();
}

/** Distinct chip types (case-insensitive), sorted 1/4, 1/8, 1/16, then names. */
export function distinctChipTypes(values: Array<string | null | undefined>): string[] {
  const byKey = new Map<string, string>();
  for (const value of values) {
    const chipType = normalizeChipType(value);
    if (chipType && !byKey.has(chipType.toLowerCase())) byKey.set(chipType.toLowerCase(), chipType);
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export function chipTypeOfSystem(system?: Pick<ChipSystem, 'chipType'> | null): string | undefined {
  return normalizeChipType(system?.chipType);
}

export function chipTypeLookup(systems: Array<Pick<ChipSystem, 'id' | 'chipType'>>): ChipTypeLookup {
  const byId = new Map(systems.map((system) => [system.id, chipTypeOfSystem(system)]));
  return (systemId) => byId.get(systemId);
}

/**
 * The chip type a job draws from. The current system wins so that changing a
 * system's chip type re-buckets its jobs; the snapshot covers deleted systems.
 */
export function jobChipType(
  job: Pick<Job, 'systemId'> & { systemSnapshot?: Pick<ChipSystem, 'chipType'> | null },
  lookup: ChipTypeLookup
): string | undefined {
  return (job.systemId ? lookup(job.systemId) : undefined) ?? chipTypeOfSystem(job.systemSnapshot);
}

/** An inventory row's chip type, resolving legacy system-tagged rows. */
export function inventoryRowChipType(
  row: Pick<ChipInventory, 'chipType' | 'systemId'>,
  lookup?: ChipTypeLookup
): string | undefined {
  return normalizeChipType(row.chipType) ?? (row.systemId && lookup ? lookup(row.systemId) : undefined);
}

/** Stable key for a blend + chip type inventory bucket. */
export function chipInventoryKey(blend: string, chipType?: string): string {
  const normalized = normalizeChipBlendName(blend);
  const type = normalizeChipType(chipType);
  return type ? `chip:${normalized}:${type.toLowerCase()}` : `chip:${normalized}`;
}

/**
 * Find the inventory row for a blend in a specific chip type. When no row has
 * that type, falls back to an unassigned (legacy) row for the same blend so
 * older stock is still found.
 */
export function findChipInventoryItem<T extends Pick<ChipInventory, 'blend' | 'chipType' | 'systemId'>>(
  rows: T[],
  blend: string,
  chipType?: string,
  lookup?: ChipTypeLookup
): T | undefined {
  const normalized = normalizeChipBlendName(blend);
  const sameBlend = rows.filter((row) => normalizeChipBlendName(row.blend) === normalized);
  if (chipType) {
    const exact = sameBlend.find((row) => sameChipType(inventoryRowChipType(row, lookup), chipType));
    if (exact) return exact;
  }
  return sameBlend.find((row) => !inventoryRowChipType(row, lookup));
}

/**
 * Chip types a blend comes in. Blends saved before chip types existed list
 * systems instead; those are translated through each system's chip type.
 * An empty list means the blend is not restricted.
 */
export function blendChipTypes(
  blend: Pick<ChipBlend, 'chipTypes' | 'systemIds'>,
  lookup: ChipTypeLookup
): string[] {
  if (blend.chipTypes) return distinctChipTypes(blend.chipTypes);
  return distinctChipTypes((blend.systemIds ?? []).map(lookup));
}

/** Whether a blend can be used with a chip type (unrestricted blends always can). */
export function blendAllowsChipType(
  blend: Pick<ChipBlend, 'chipTypes' | 'systemIds'>,
  chipType: string | undefined,
  lookup: ChipTypeLookup
): boolean {
  const types = blendChipTypes(blend, lookup);
  if (types.length === 0 || !chipType) return true;
  return types.some((type) => sameChipType(type, chipType));
}
