import { Job, JobStatus } from '../types/index.js';
import { NH_ME_ZIP_CENTROIDS, ZipCentroid } from './nhMeZipRegistry.js';

export type ZipExclusionReason = 'missing' | 'invalid-format' | 'out-of-scope-or-unrecognized';

export interface ZipAggregate extends ZipCentroid {
  zip: string;
  estimates: number;
  won: number;
  lost: number;
}

export interface ZipGeographyReport {
  rows: ZipAggregate[];
  totals: { estimates: number; won: number; lost: number };
  excluded: Record<ZipExclusionReason, number>;
}

export type ZipAddressResolution =
  | { zip: string; centroid: ZipCentroid }
  | { reason: ZipExclusionReason };

// A US ZIP token must be isolated from letters/digits and is either 5 digits or ZIP+4.
// This deliberately does not infer a state from numeric prefixes or address text.
const ZIP_TOKEN = /(?<![A-Za-z0-9-])(?<zip>\d{5})(?:-\d{4})?(?![A-Za-z0-9-])/g;
const FIVE_DIGIT_RUN = /\d{5}/;

export function extractZipCandidates(address?: string): string[] {
  if (!address) return [];
  return Array.from(address.matchAll(ZIP_TOKEN), (match) => match.groups?.zip ?? match[1]);
}

export function resolveNhMeZip(address?: string): ZipAddressResolution {
  if (!address?.trim()) return { reason: 'missing' };

  const candidates = extractZipCandidates(address);
  if (candidates.length === 0) {
    return { reason: FIVE_DIGIT_RUN.test(address) ? 'invalid-format' : 'missing' };
  }

  // Addresses conventionally place the destination ZIP last. Its exact registry membership
  // is authoritative; never fall back to an earlier address/reference ZIP.
  const zip = candidates[candidates.length - 1];
  const centroid = NH_ME_ZIP_CENTROIDS[zip];
  return centroid ? { zip, centroid } : { reason: 'out-of-scope-or-unrecognized' };
}

export function isWonStatus(status: JobStatus): boolean {
  return status === 'Won';
}

export function isLostStatus(status: JobStatus): boolean {
  return status === 'Lost';
}

export function aggregateJobsByZip(jobs: readonly Pick<Job, 'customerAddress' | 'status'>[]): ZipGeographyReport {
  const aggregates = new Map<string, ZipAggregate>();
  const excluded: Record<ZipExclusionReason, number> = {
    missing: 0,
    'invalid-format': 0,
    'out-of-scope-or-unrecognized': 0,
  };

  for (const job of jobs) {
    const resolution = resolveNhMeZip(job.customerAddress);
    if ('reason' in resolution) {
      excluded[resolution.reason] += 1;
      continue;
    }

    const existing = aggregates.get(resolution.zip) ?? {
      zip: resolution.zip,
      ...resolution.centroid,
      estimates: 0,
      won: 0,
      lost: 0,
    };
    existing.estimates += 1;
    if (isWonStatus(job.status)) existing.won += 1;
    if (isLostStatus(job.status)) existing.lost += 1;
    aggregates.set(resolution.zip, existing);
  }

  const rows = Array.from(aggregates.values()).sort((a, b) => (
    b.estimates - a.estimates || a.zip.localeCompare(b.zip)
  ));
  const totals = rows.reduce(
    (summary, row) => ({
      estimates: summary.estimates + row.estimates,
      won: summary.won + row.won,
      lost: summary.lost + row.lost,
    }),
    { estimates: 0, won: 0, lost: 0 }
  );

  return { rows, totals, excluded };
}
