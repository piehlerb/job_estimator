import { canonicalizeTown, parseAddress } from './addressParse.js';
import type { AddressParseTier, Customer, Job, Lead } from '../types/index.js';

/**
 * The single write path for structured address fields.
 *
 * Every place that saves a job, lead or customer routes through here, so the
 * rules below hold everywhere rather than being re-implemented per form.
 *
 * FOUR RULES
 *
 * 1. The raw text is the source; the structured fields are a projection of it.
 *    Raw is never written from the structured side.
 *
 * 2. A confirmed row is untouchable. `addressVerifiedAt` set, or tier 'M', means
 *    a human has had their say and no automated derivation may overwrite it —
 *    without this the cleanup worklist never empties. The one exception is the
 *    raw address itself changing, which means this is a different address now, so
 *    the old projection is not worth protecting.
 *
 * 3. When the raw address changes, the whole group is replaced, absent members
 *    included. Merging field by field is what welds one address's street onto
 *    another's town — the same mistake the GHL webhook merge exists to avoid.
 *
 * 4. Nothing invalid is ever emitted. A state is two uppercase letters or absent;
 *    a ZIP is five digits or absent. Sync pushes are BATCHED upserts, so a single
 *    CHECK violation fails an entire table's batch, not just one row.
 */

/** Address fields in a shape that is neutral between Job, Lead and Customer. */
export interface AddressFieldSet {
  street?: string;
  street2?: string;
  city?: string;
  state?: string;
  zip?: string;
  tier?: AddressParseTier;
  verifiedAt?: string;
}

const STATE_PATTERN = /^[A-Z]{2}$/;
const ZIP_PATTERN = /^[0-9]{5}$/;

/** Tiers the parser is trusted to apply on its own. 'A!' and 'D' need a human. */
const AUTO_APPLY_TIERS: ReadonlySet<AddressParseTier> = new Set<AddressParseTier>(['A', 'B', 'C']);

function clean(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

/** Two uppercase letters, or nothing. Never a partial or lower-cased value. */
function safeState(value?: string): string | undefined {
  const candidate = clean(value)?.toUpperCase();
  return candidate && STATE_PATTERN.test(candidate) ? candidate : undefined;
}

/** Five digits, or nothing. A ZIP+4 keeps its prefix. */
function safeZip(value?: string): string | undefined {
  const digits = clean(value)?.replace(/\D/g, '');
  if (!digits) return undefined;
  const candidate = digits.length === 9 ? digits.slice(0, 5) : digits;
  return ZIP_PATTERN.test(candidate) ? candidate : undefined;
}

function isRatcheted(fields: AddressFieldSet): boolean {
  return Boolean(fields.verifiedAt) || fields.tier === 'M';
}

/**
 * Tidy values that are already present, without deriving anything new.
 *
 * This is what fixes GHL's inconsistent casing: a lead arriving as "PORTLAND"
 * becomes "Portland" so it groups with every other Portland job.
 */
function canonicalize(fields: AddressFieldSet): AddressFieldSet {
  const state = safeState(fields.state);
  const town = canonicalizeTown(fields.city, state);
  return {
    ...fields,
    street: clean(fields.street),
    street2: clean(fields.street2),
    // An unrecognized town keeps the value it came with — out of scope is not wrong.
    city: town?.city ?? clean(fields.city),
    state: town?.state ?? state,
    zip: safeZip(fields.zip),
  };
}

/**
 * Work out the structured fields for a record.
 *
 * `rawChanged` says whether the free-text address differs from what was stored.
 * When it has, the projection is rebuilt from scratch; when it has not, existing
 * values are canonicalized and only genuinely empty ones are filled.
 */
export function resolveAddressFields(
  raw: string | undefined,
  existing: AddressFieldSet,
  rawChanged: boolean
): AddressFieldSet {
  if (rawChanged) {
    const proposal = parseAddress(raw);
    if (!AUTO_APPLY_TIERS.has(proposal.tier)) {
      // A contradiction or an unresolvable address: record the tier so the
      // cleanup worklist can find it, and write no values at all. A blank field
      // beats a confidently wrong one.
      return { tier: proposal.tier };
    }
    return canonicalize({
      street: proposal.street,
      // street2 is not extracted by the parser, and a unit number belongs to the
      // address it arrived with, so a new address does not inherit the old one.
      street2: undefined,
      city: proposal.city,
      state: proposal.state,
      zip: proposal.zip,
      tier: proposal.tier,
      verifiedAt: undefined,
    });
  }

  if (isRatcheted(existing)) return existing;

  const current = canonicalize(existing);
  const complete = current.street && current.city && current.state && current.zip;
  if (complete) return current;

  const proposal = parseAddress(raw);
  if (!AUTO_APPLY_TIERS.has(proposal.tier)) {
    // Keep whatever is already there, but record why the rest is missing.
    return { ...current, tier: current.tier ?? proposal.tier };
  }

  const filled = canonicalize({
    street: current.street ?? proposal.street,
    street2: current.street2,
    city: current.city ?? proposal.city,
    state: current.state ?? proposal.state,
    zip: current.zip ?? proposal.zip,
    tier: current.tier ?? proposal.tier,
    verifiedAt: current.verifiedAt,
  });
  return filled;
}

/**
 * Stamp a field set as hand-entered, which puts it permanently out of reach of
 * automated derivation. Called when someone edits a structured field directly.
 */
export function markAddressVerified(
  fields: AddressFieldSet,
  nowIso = new Date().toISOString()
): AddressFieldSet {
  return { ...canonicalize(fields), tier: 'M', verifiedAt: nowIso };
}

// ---------------------------------------------------------------------------
// Adapters. Job prefixes these with customer_; Lead and Customer do not.
// ---------------------------------------------------------------------------

export function withJobAddressFields(job: Job, previous?: Job): Job {
  const fields = resolveAddressFields(
    job.customerAddress,
    {
      street: job.customerStreet,
      street2: job.customerStreet2,
      city: job.customerCity,
      state: job.customerState,
      zip: job.customerZip,
      tier: job.addressParseTier,
      verifiedAt: job.addressVerifiedAt,
    },
    (previous?.customerAddress ?? undefined) !== (job.customerAddress ?? undefined)
  );

  return {
    ...job,
    customerStreet: fields.street,
    customerStreet2: fields.street2,
    customerCity: fields.city,
    customerState: fields.state,
    customerZip: fields.zip,
    addressParseTier: fields.tier,
    addressVerifiedAt: fields.verifiedAt,
  };
}

export function withCustomerAddressFields(customer: Customer, previous?: Customer): Customer {
  const fields = resolveAddressFields(
    customer.address,
    {
      street: customer.street,
      street2: customer.street2,
      city: customer.city,
      state: customer.state,
      zip: customer.zip,
      tier: customer.addressParseTier,
      verifiedAt: customer.addressVerifiedAt,
    },
    (previous?.address ?? undefined) !== (customer.address ?? undefined)
  );

  return {
    ...customer,
    street: fields.street,
    street2: fields.street2,
    city: fields.city,
    state: fields.state,
    zip: fields.zip,
    addressParseTier: fields.tier,
    addressVerifiedAt: fields.verifiedAt,
  };
}

export function withLeadAddressFields(lead: Lead, previous?: Lead): Lead {
  const fields = resolveAddressFields(
    lead.address,
    {
      street: lead.street,
      street2: lead.street2,
      city: lead.city,
      state: lead.state,
      zip: lead.zip,
      tier: lead.addressParseTier,
      verifiedAt: lead.addressVerifiedAt,
    },
    (previous?.address ?? undefined) !== (lead.address ?? undefined)
  );

  return {
    ...lead,
    street: fields.street,
    street2: fields.street2,
    city: fields.city,
    state: fields.state,
    zip: fields.zip,
    addressParseTier: fields.tier,
    addressVerifiedAt: fields.verifiedAt,
  };
}
