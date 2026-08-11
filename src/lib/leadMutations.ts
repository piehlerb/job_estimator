import type { Lead, LeadDispositionReason, LeadStage } from '../types/index.js';
import { withLeadAddressFields } from './addressFields.js';

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

  // Re-derive the structured address. Passing the original lead lets the helper
  // see whether the raw address was edited: if it was, the projection is rebuilt,
  // otherwise gaps are filled and a confirmed address is left alone.
  return withLeadAddressFields(next, lead);
}

export function softDeleteLead(lead: Lead, nowIso = new Date().toISOString()): Lead {
  return {
    ...lead,
    deleted: true,
    updatedAt: nowIso,
  };
}
