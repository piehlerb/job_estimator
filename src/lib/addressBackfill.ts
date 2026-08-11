import { standardZipsForTown } from './addressParse.js';
import { markAddressVerified, resolveAddressFields, type AddressFieldSet } from './addressFields.js';
import type { AddressParseTier, Customer, Job, Lead } from '../types/index.js';

/**
 * The one-time pass that derives structured addresses for records that predate the
 * parser, plus the worklist of everything it refused to decide.
 *
 * Deliberately NOT run automatically at startup like the other migrations in
 * jobMigration.ts. It touches every job, lead and customer at once, and the point
 * of tiers is that a human sees the contradictions rather than having them written
 * silently. The UI computes a preview, shows the breakdown, and applies only on an
 * explicit action.
 *
 * Idempotent. Applying twice changes nothing the second time, because a record
 * whose fields are already complete produces no proposal, and a confirmed record is
 * never touched at all.
 */

export type AddressEntityType = 'job' | 'lead' | 'customer';

export interface AddressProposalRow {
  entityType: AddressEntityType;
  id: string;
  /** Who this record is, for display. Falls back to the id when there is no name. */
  label: string;
  raw?: string;
  current: AddressFieldSet;
  proposed: AddressFieldSet;
  tier: AddressParseTier;
  note?: string;
}

export interface AddressBackfillPreview {
  /** Tier A/B/C with something to write. Safe to apply as a batch. */
  applicable: AddressProposalRow[];
  /** Tier A! — the ZIP contradicts the typed town. Needs a person. */
  conflicts: AddressProposalRow[];
  /** Tier D — nothing resolvable, or no address at all. */
  unresolved: AddressProposalRow[];
  /** Already complete, or confirmed by hand. Nothing to do. */
  settledCount: number;
  tierCounts: Partial<Record<AddressParseTier, number>>;
}

/** A group of records in one town, all missing a ZIP that the town determines. */
export interface ZipFillGroup {
  state: string;
  city: string;
  zip: string;
  rows: AddressProposalRow[];
}

function fieldsOf(row: {
  street?: string;
  street2?: string;
  city?: string;
  state?: string;
  zip?: string;
  addressParseTier?: AddressParseTier;
  addressVerifiedAt?: string;
}): AddressFieldSet {
  return {
    street: row.street,
    street2: row.street2,
    city: row.city,
    state: row.state,
    zip: row.zip,
    tier: row.addressParseTier,
    verifiedAt: row.addressVerifiedAt,
  };
}

function jobFields(job: Job): AddressFieldSet {
  return {
    street: job.customerStreet,
    street2: job.customerStreet2,
    city: job.customerCity,
    state: job.customerState,
    zip: job.customerZip,
    tier: job.addressParseTier,
    verifiedAt: job.addressVerifiedAt,
  };
}

function sameFields(a: AddressFieldSet, b: AddressFieldSet): boolean {
  return (
    a.street === b.street &&
    a.street2 === b.street2 &&
    a.city === b.city &&
    a.state === b.state &&
    a.zip === b.zip &&
    a.tier === b.tier &&
    a.verifiedAt === b.verifiedAt
  );
}

function isSettled(fields: AddressFieldSet): boolean {
  if (fields.verifiedAt || fields.tier === 'M') return true;
  return Boolean(fields.street && fields.city && fields.state && fields.zip);
}

function buildRow(
  entityType: AddressEntityType,
  id: string,
  label: string,
  raw: string | undefined,
  current: AddressFieldSet
): AddressProposalRow | undefined {
  // The raw text has not changed — this is a gap-filling pass over stored records,
  // never a rebuild, so a hand correction stays safe.
  const proposed = resolveAddressFields(raw, current, false);
  const tier = proposed.tier ?? current.tier ?? 'D';
  if (sameFields(current, proposed) && isSettled(current)) return undefined;

  return { entityType, id, label, raw, current, proposed, tier };
}

export function buildAddressBackfillPreview(
  jobs: Job[],
  leads: Lead[],
  customers: Customer[]
): AddressBackfillPreview {
  const rows: AddressProposalRow[] = [];
  let settledCount = 0;

  const consider = (row: AddressProposalRow | undefined) => {
    if (row) rows.push(row);
    else settledCount++;
  };

  for (const job of jobs) {
    if (job.deleted) continue;
    consider(
      buildRow(
        'job',
        job.id,
        job.customerName?.trim() || job.name || job.id,
        job.customerAddress,
        jobFields(job)
      )
    );
  }
  for (const lead of leads) {
    if (lead.deleted) continue;
    consider(buildRow('lead', lead.id, lead.name?.trim() || lead.id, lead.address, fieldsOf(lead)));
  }
  for (const customer of customers) {
    if (customer.deleted) continue;
    consider(
      buildRow('customer', customer.id, customer.name?.trim() || customer.id, customer.address, fieldsOf(customer))
    );
  }

  const tierCounts: Partial<Record<AddressParseTier, number>> = {};
  for (const row of rows) tierCounts[row.tier] = (tierCounts[row.tier] ?? 0) + 1;

  return {
    applicable: rows.filter((r) => r.tier === 'A' || r.tier === 'B' || r.tier === 'C'),
    conflicts: rows.filter((r) => r.tier === 'A!'),
    unresolved: rows.filter((r) => r.tier === 'D'),
    settledCount,
    tierCounts,
  };
}

/**
 * Group rows that have a town but no ZIP, where the town determines the ZIP
 * outright. These can be filled for a whole town in one action with no research.
 * Towns served by several ZIPs are excluded — the street is needed to choose.
 */
export function buildZipFillGroups(rows: AddressProposalRow[]): ZipFillGroup[] {
  const groups = new Map<string, ZipFillGroup>();

  for (const row of rows) {
    const city = row.proposed.city ?? row.current.city;
    const state = row.proposed.state ?? row.current.state;
    const zip = row.proposed.zip ?? row.current.zip;
    if (zip || !city || !state) continue;

    const candidates = standardZipsForTown(state, city);
    if (candidates.length !== 1) continue;

    const key = `${state}|${city.toLowerCase()}`;
    const group = groups.get(key) ?? { state, city, zip: candidates[0], rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  }

  return [...groups.values()].sort(
    (a, b) => b.rows.length - a.rows.length || a.city.localeCompare(b.city)
  );
}

/** Apply a proposal to a job, leaving every non-address field untouched. */
export function applyProposalToJob(job: Job, fields: AddressFieldSet, nowIso: string): Job {
  return {
    ...job,
    customerStreet: fields.street,
    customerStreet2: fields.street2,
    customerCity: fields.city,
    customerState: fields.state,
    customerZip: fields.zip,
    addressParseTier: fields.tier,
    addressVerifiedAt: fields.verifiedAt,
    updatedAt: nowIso,
    synced: false,
  };
}

export function applyProposalToLead(lead: Lead, fields: AddressFieldSet, nowIso: string): Lead {
  return {
    ...lead,
    street: fields.street,
    street2: fields.street2,
    city: fields.city,
    state: fields.state,
    zip: fields.zip,
    addressParseTier: fields.tier,
    addressVerifiedAt: fields.verifiedAt,
    updatedAt: nowIso,
  };
}

export function applyProposalToCustomer(
  customer: Customer,
  fields: AddressFieldSet,
  nowIso: string
): Customer {
  return {
    ...customer,
    street: fields.street,
    street2: fields.street2,
    city: fields.city,
    state: fields.state,
    zip: fields.zip,
    addressParseTier: fields.tier,
    addressVerifiedAt: fields.verifiedAt,
    updatedAt: nowIso,
  };
}

/**
 * The field set to write when a person resolves a row by hand — filling a ZIP,
 * choosing between a typed town and a ZIP's town. Stamped tier 'M' with a
 * confirmation time, which puts it permanently beyond automated derivation.
 */
export function resolveByHand(
  fields: AddressFieldSet,
  overrides: Partial<AddressFieldSet>,
  nowIso = new Date().toISOString()
): AddressFieldSet {
  return markAddressVerified({ ...fields, ...overrides }, nowIso);
}
