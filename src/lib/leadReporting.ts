import type { AdSpend, Lead, LeadAppointment } from '../types/index.js';
import { toLocalDateString } from './dateUtils.js';

export type Territory = 'In territory' | 'Out of territory';

export const percent = (count: number, total: number) => total ? `${(count / total * 100).toFixed(1)}%` : '—';

export function leadTerritory(lead: Lead): Territory {
  if (lead.dispositionReason === 'Out of Territory') return 'Out of territory';
  // Business rule: all leads count as in territory unless explicitly excluded.
  return 'In territory';
}

export function summarizeLeads(leads: Lead[], appointments: LeadAppointment[]) {
  const appointmentIds = new Set(appointments.filter(a => !a.deleted).map(a => a.leadId));
  const active = leads.filter(l => !l.deleted);
  const stages: Record<string, number> = {};
  const dispositions: Record<string, number> = {};
  const territory = { 'In territory': 0, 'Out of territory': 0 };
  let booked = 0, bookedInTerritory = 0, decided = 0, won = 0;
  for (const lead of active) {
    const location = leadTerritory(lead);
    territory[location]++;
    const isBooked = appointmentIds.has(lead.id) || ['Estimate Booked', 'Estimate Completed', 'Quoted', 'Won'].includes(lead.stage);
    if (isBooked) booked++;
    if (isBooked && location === 'In territory') bookedInTerritory++;
    if (isBooked || ['Won', 'Lost', 'Disqualified'].includes(lead.stage)) decided++;
    if (lead.stage === 'Won') won++;
    stages[lead.stage] = (stages[lead.stage] || 0) + 1;
    const reason = lead.dispositionReason || 'No disposition';
    dispositions[reason] = (dispositions[reason] || 0) + 1;
  }
  return { leads: active.length, booked, bookedInTerritory, decided, open: active.length - decided, won, territory, stages, dispositions };
}

export function costPer(spend: number | null, count: number): number | null {
  return spend !== null && count > 0 ? spend / count : null;
}

/** Name a lead's source is grouped under */
export const leadSourceOf = (lead: Pick<Lead, 'source'>) => lead.source?.trim() || '(No Source)';

/** Spend entered before spend was tracked per source */
export const UNATTRIBUTED_SOURCE = '(Unattributed)';

export const spendSourceOf = (record: Pick<AdSpend, 'source'>) => record.source?.trim() || UNATTRIBUTED_SOURCE;

/** Month (YYYY-MM) a lead counts in: first seen, else created; '' if neither parses */
export function leadMonth(lead: Pick<Lead, 'firstSeenAt' | 'createdAt'>): string {
  const date = new Date(lead.firstSeenAt || lead.createdAt);
  return Number.isNaN(date.getTime()) ? '' : toLocalDateString(date).slice(0, 7);
}

export interface SourceCost {
  spend: number;
  /** Lead outcomes from this source, counted only in months it has spend recorded */
  leads: number;
  inTerritory: number;
  booked: number;
}

/**
 * Spend and lead outcomes per source over a set of months. A source's leads
 * count only in months where that source has spend recorded: a month with no
 * spend entered is missing data, not free leads. Only sources with spend
 * appear. Spend rows with no source are grouped under UNATTRIBUTED_SOURCE.
 */
export function costsBySource(
  leads: Lead[],
  appointments: LeadAppointment[],
  spend: AdSpend[],
  months: ReadonlySet<string>
): Map<string, SourceCost> {
  const spendMonths = new Map<string, Set<string>>();
  const costs = new Map<string, SourceCost>();
  for (const record of spend) {
    if (record.deleted || !months.has(record.month)) continue;
    const source = spendSourceOf(record);
    const entry = costs.get(source) ?? { spend: 0, leads: 0, inTerritory: 0, booked: 0 };
    entry.spend += record.amount;
    costs.set(source, entry);
    const set = spendMonths.get(source) ?? new Set<string>();
    set.add(record.month);
    spendMonths.set(source, set);
  }
  const bySource = new Map<string, Lead[]>();
  for (const lead of leads) {
    if (lead.deleted) continue;
    const source = leadSourceOf(lead);
    if (!spendMonths.get(source)?.has(leadMonth(lead))) continue;
    const group = bySource.get(source) ?? [];
    group.push(lead);
    bySource.set(source, group);
  }
  for (const [source, group] of bySource) {
    const summary = summarizeLeads(group, appointments);
    const entry = costs.get(source)!;
    entry.leads = summary.leads;
    entry.inTerritory = summary.territory['In territory'];
    entry.booked = summary.booked;
  }
  return costs;
}
