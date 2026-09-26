import type { ChipInventory } from '../types/index.js';
import { normalizeChipBlendName } from './syncHelpers.js';

/**
 * Chip inventory is tracked per blend AND chip system: "Blue" in the 1/4 system
 * and "Blue" in the 1/8 system are different physical products. Rows without a
 * systemId are legacy/unassigned stock that predates this split.
 */

/** Stable key for a blend + system inventory bucket. */
export function chipInventoryKey(blend: string, systemId?: string): string {
  const normalized = normalizeChipBlendName(blend);
  return systemId ? `chip:${normalized}:${systemId}` : `chip:${normalized}`;
}

/**
 * Find the inventory row for a blend in a specific system. When no row is
 * assigned to that system, falls back to an unassigned (legacy) row for the
 * same blend so older stock is still found.
 */
export function findChipInventoryItem<T extends Pick<ChipInventory, 'blend' | 'systemId'>>(
  rows: T[],
  blend: string,
  systemId?: string
): T | undefined {
  const normalized = normalizeChipBlendName(blend);
  const sameBlend = rows.filter((row) => normalizeChipBlendName(row.blend) === normalized);
  if (systemId) {
    const exact = sameBlend.find((row) => row.systemId === systemId);
    if (exact) return exact;
  }
  return sameBlend.find((row) => !row.systemId);
}
