/**
 * Running inventory balance across upcoming jobs.
 *
 * Jobs are processed in the order given (install date order). Each material
 * starts from its on-hand quantity and is drawn down by each job in turn, so
 * every job shows what is left once it and every earlier job are done.
 *
 * Chip lines are reclaimable: a share of the chip each job uses (the reclaim
 * rate) is recovered once the job is done and goes back into inventory, so it
 * is available to every later job using the same chip.
 */

export type ProjectionUnit = 'gal' | 'lbs' | 'oz';

export interface ProjectionNeed {
  key: string; // Inventory item key (coating SKU key, chip key, tint key, ...)
  label: string;
  unit: ProjectionUnit;
  amount: number; // Quantity this job needs
  onHand: number; // Starting inventory for this key (read the first time the key appears)
  reclaimable?: boolean; // Chip: part of what the job uses is reclaimed back into inventory
}

export interface ProjectionJob {
  id: string;
  needs: ProjectionNeed[];
}

export interface ProjectedLine {
  key: string;
  label: string;
  unit: ProjectionUnit;
  needed: number; // Drawn from inventory for this job
  reclaimed: number; // Returned to inventory after this job (chip reclaim)
  before: number; // Inventory before this job
  after: number; // Inventory after this job, net of reclaim (negative = short)
}

export function projectInventoryAfterJobs(
  jobs: ProjectionJob[],
  reclaimRate = 0
): Map<string, ProjectedLine[]> {
  const balance = new Map<string, number>();
  const result = new Map<string, ProjectedLine[]>();

  for (const job of jobs) {
    // Merge needs that share an inventory key so each item appears once per job
    const merged = new Map<string, ProjectionNeed>();
    for (const need of job.needs) {
      if (!(need.amount > 0)) continue;
      const existing = merged.get(need.key);
      if (existing) existing.amount += need.amount;
      else merged.set(need.key, { ...need });
    }

    const lines: ProjectedLine[] = [];
    for (const need of merged.values()) {
      const before = balance.has(need.key) ? balance.get(need.key)! : need.onHand;
      const reclaimed = need.reclaimable ? need.amount * reclaimRate : 0;
      const after = before - need.amount + reclaimed;
      balance.set(need.key, after);
      lines.push({
        key: need.key,
        label: need.label,
        unit: need.unit,
        needed: need.amount,
        reclaimed,
        before,
        after,
      });
    }
    result.set(job.id, lines);
  }

  return result;
}
