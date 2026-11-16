import type { Lead, LeadStage } from '../types/index.js';
import { summarizeLeadContacts } from './leadContacts.js';
import { timestampToLocalDateString, toLocalDateString } from './dateUtils.js';

export interface LeadContactReportRow {
  lead: Lead;
  calls: number;
  texts: number;
  /** Most recent call or text to the lead; absent when never contacted */
  lastContactedAt?: string;
  /** Whole local calendar days since the last contact (0 = today); absent when never contacted */
  daysSinceContact?: number;
}

/**
 * 'stalest' puts leads nobody has contacted first, then the longest since
 * contact; 'recent' is the reverse, with never-contacted leads last.
 */
export type LeadContactReportOrder = 'stalest' | 'recent';

/** The report always leaves these out */
export const LEAD_CONTACT_REPORT_EXCLUDED_STAGES: ReadonlySet<LeadStage> = new Set(['Disqualified']);

function localDayNumber(dateOnly: string): number {
  const [y, m, d] = dateOnly.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

/** Calendar days (local) between the contact and today; never negative */
export function daysSinceLocalDay(isoTimestamp: string, now: Date = new Date()): number {
  const days = localDayNumber(toLocalDateString(now)) - localDayNumber(timestampToLocalDateString(isoTimestamp));
  return Math.max(0, days);
}

function leadLabel(lead: Lead): string {
  return (lead.name?.trim() || lead.phone || lead.email || '').toLowerCase();
}

/**
 * Leads that are not disqualified or deleted, with their call/text counts,
 * sorted by when they were last contacted. Ties (and never-contacted leads)
 * fall back to the oldest lead first, then by name, so the order is stable.
 */
export function buildLeadContactReport(
  leads: Lead[],
  options: { order?: LeadContactReportOrder; stages?: ReadonlySet<LeadStage>; now?: Date } = {}
): LeadContactReportRow[] {
  const { order = 'stalest', stages, now = new Date() } = options;

  const rows: LeadContactReportRow[] = leads
    .filter((lead) => !lead.deleted && !LEAD_CONTACT_REPORT_EXCLUDED_STAGES.has(lead.stage))
    .filter((lead) => !stages || stages.has(lead.stage))
    .map((lead) => {
      const { calls, texts, lastContactedAt } = summarizeLeadContacts(lead);
      const row: LeadContactReportRow = { lead, calls, texts };
      if (lastContactedAt) {
        row.lastContactedAt = lastContactedAt;
        row.daysSinceContact = daysSinceLocalDay(lastContactedAt, now);
      }
      return row;
    });

  const created = (row: LeadContactReportRow) => new Date(row.lead.createdAt).getTime() || 0;
  const contacted = (row: LeadContactReportRow) => new Date(row.lastContactedAt as string).getTime();

  return rows.sort((a, b) => {
    const aNever = !a.lastContactedAt;
    const bNever = !b.lastContactedAt;
    if (aNever !== bNever) {
      // Never-contacted leads are the stalest of all
      return (aNever ? -1 : 1) * (order === 'stalest' ? 1 : -1);
    }
    if (!aNever && !bNever) {
      const diff = contacted(a) - contacted(b);
      if (diff !== 0) return order === 'stalest' ? diff : -diff;
    }
    return created(a) - created(b) || leadLabel(a.lead).localeCompare(leadLabel(b.lead));
  });
}
