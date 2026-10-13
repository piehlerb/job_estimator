import type { Lead, LeadContactAttempt, LeadContactChannel } from '../types/index.js';
import { addDaysToLocalDate, timestampToLocalDateString, toLocalDateString } from './dateUtils.js';

export interface LeadContactSummary {
  calls: number;
  texts: number;
  /** Most recent attempt of either kind, absent when the lead was never contacted */
  lastContactedAt?: string;
}

function validAttempts(lead: Pick<Lead, 'contactLog'>): LeadContactAttempt[] {
  return (lead.contactLog ?? []).filter((attempt) => !Number.isNaN(new Date(attempt.at).getTime()));
}

export function summarizeLeadContacts(lead: Pick<Lead, 'contactLog'>): LeadContactSummary {
  let calls = 0;
  let texts = 0;
  let lastContactedAt: string | undefined;
  let lastTime = -Infinity;

  for (const attempt of validAttempts(lead)) {
    if (attempt.channel === 'call') calls += 1;
    if (attempt.channel === 'text') texts += 1;
    const time = new Date(attempt.at).getTime();
    if (time > lastTime) {
      lastTime = time;
      lastContactedAt = attempt.at;
    }
  }

  return { calls, texts, lastContactedAt };
}

/** Newest first, for display */
export function sortedContactLog(lead: Pick<Lead, 'contactLog'>): LeadContactAttempt[] {
  return [...(lead.contactLog ?? [])].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

/**
 * Record a call or text made just now from the leads list. A lead still at New
 * moves to Contact Attempted, since that is what the stage means.
 */
export function logLeadContact(
  lead: Lead,
  channel: LeadContactChannel,
  nowIso = new Date().toISOString(),
  id: string = crypto.randomUUID()
): Lead {
  return {
    ...lead,
    contactLog: [...(lead.contactLog ?? []), { id, channel, at: nowIso }],
    stage: lead.stage === 'New' ? 'Contact Attempted' : lead.stage,
    updatedAt: nowIso,
  };
}

export type LastContactedFilter =
  | { kind: 'any' }
  | { kind: 'never' }
  /** Last contact fell on one of the most recent `days` calendar days, today included */
  | { kind: 'within'; days: number }
  /** Contacted before, but not within the most recent `days` calendar days */
  | { kind: 'olderThan'; days: number }
  /** Last contact on a calendar day between `from` and `to` (YYYY-MM-DD, inclusive, either optional) */
  | { kind: 'range'; from?: string; to?: string };

/** Calendar days are local, matching the rest of the app's date-only fields (see dateUtils). */
export function matchesLastContactedFilter(
  lead: Pick<Lead, 'contactLog'>,
  filter: LastContactedFilter,
  now: Date = new Date()
): boolean {
  if (filter.kind === 'any') return true;

  const { lastContactedAt } = summarizeLeadContacts(lead);
  if (filter.kind === 'never') return !lastContactedAt;
  if (!lastContactedAt) return false;

  const lastDay = timestampToLocalDateString(lastContactedAt);
  const today = toLocalDateString(now);

  switch (filter.kind) {
    case 'within':
      return lastDay >= addDaysToLocalDate(today, -(filter.days - 1));
    case 'olderThan':
      return lastDay < addDaysToLocalDate(today, -(filter.days - 1));
    case 'range':
      return (!filter.from || lastDay >= filter.from) && (!filter.to || lastDay <= filter.to);
  }
}

/** ISO timestamp → value for an <input type="datetime-local"> in local time */
export function toDateTimeLocalValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${toLocalDateString(date)}T${hh}:${mm}`;
}

/** <input type="datetime-local"> value (local time) → ISO timestamp, or undefined if blank/invalid */
export function fromDateTimeLocalValue(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
