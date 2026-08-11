import type { Lead, LeadDispositionReason, LeadStage } from '../types/index.js';
import { withLeadAddressFields, type AddressFieldSet } from './addressFields.js';

export type LeadEditInput = {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  source?: string;
  campaign?: string;
  stage: LeadStage;
  dispositionReason?: LeadDispositionReason | '';
  dispositionNotes?: string;
  /**
   * The structured address as shown, and possibly corrected, in the form. When it
   * carries tier 'M' the person edited it directly, and it is written verbatim
   * rather than re-derived.
   */
  addressFields?: AddressFieldSet;
};

const TERMINAL_STAGES = new Set<LeadStage>(['Won', 'Lost', 'Disqualified']);
const DISPOSITION_STAGES = new Set<LeadStage>(['Lost', 'Disqualified']);

function cleanOptional(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function applyLeadEdit(
  lead: Lead,
  input: LeadEditInput,
  nowIso = new Date().toISOString()
): Lead {
  const next: Lead = {
    ...lead,
    name: cleanOptional(input.name),
    phone: cleanOptional(input.phone),
    email: cleanOptional(input.email),
    address: cleanOptional(input.address),
    source: cleanOptional(input.source),
    campaign: cleanOptional(input.campaign),
    stage: input.stage,
    updatedAt: nowIso,
  };

  if (TERMINAL_STAGES.has(input.stage)) {
    next.closedAt = lead.closedAt || nowIso;
  } else {
    next.closedAt = undefined;
  }

  if (DISPOSITION_STAGES.has(input.stage)) {
    next.dispositionReason = input.dispositionReason || undefined;
    next.dispositionNotes = cleanOptional(input.dispositionNotes);
  } else {
    next.dispositionReason = undefined;
    next.dispositionNotes = undefined;
  }

  if (input.addressFields) {
    const f = input.addressFields;
    next.street = f.street;
    next.street2 = f.street2;
    next.city = f.city;
    next.state = f.state;
    next.zip = f.zip;
    next.addressParseTier = f.tier;
    next.addressVerifiedAt = f.verifiedAt;

    // A hand correction is the person's final word — writing it verbatim is the
    // whole point of the ratchet.
    if (f.verifiedAt || f.tier === 'M') return next;
  }

  // Otherwise re-derive. Passing the original lead lets the helper see whether the
  // raw address was edited: if it was, the projection is rebuilt, otherwise gaps
  // are filled and a confirmed address is left alone.
  return withLeadAddressFields(next, lead);
}

export function softDeleteLead(lead: Lead, nowIso = new Date().toISOString()): Lead {
  return {
    ...lead,
    deleted: true,
    updatedAt: nowIso,
  };
}
