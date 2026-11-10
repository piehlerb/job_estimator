import type { Lead, LeadContactAttempt, LeadContactChannel } from '../types/index.js';
import { addDaysToLocalDate, timestampToLocalDateString, toLocalDateString } from './dateUtils.js';

export interface LeadContactSummary {
  /** Calls made to the lead */
  calls: number;
  /** Texts sent to the lead */
  texts: number;
  /** Most recent attempt of either kind, absent when the lead was never contacted */
  lastContactedAt?: string;
  /** Most recent call or text from the lead, absent when they never reached back */
  lastInboundAt?: string;
}

/** Whether an entry is the lead reaching the business, not an attempt made to them. */
export function isInboundContact(attempt: Pick<LeadContactAttempt, 'direction'>): boolean {
  return attempt.direction === 'inbound';
}

/** Entries reported by GoHighLevel. The server restores them if a save drops them, so they are not editable here. */
export function isGhlContact(attempt: Pick<LeadContactAttempt, 'source'>): boolean {
  return attempt.source === 'ghl';
}

function validAttempts(lead: Pick<Lead, 'contactLog'>): LeadContactAttempt[] {
  return (lead.contactLog ?? []).filter((attempt) => !Number.isNaN(new Date(attempt.at).getTime()));
}

/**
 * Counts and "last contacted" cover attempts only — the business reaching out.
 * A lead calling in or replying is not an attempt, and counting it would make a
 * lead nobody has called back look freshly contacted; it is reported separately
 * as lastInboundAt.
 */
export function summarizeLeadContacts(lead: Pick<Lead, 'contactLog'>): LeadContactSummary {
  let calls = 0;
  let texts = 0;
  let lastContactedAt: string | undefined;
  let lastInboundAt: string | undefined;
  let lastTime = -Infinity;
  let lastInboundTime = -Infinity;

  for (const attempt of validAttempts(lead)) {
    const time = new Date(attempt.at).getTime();
    if (isInboundContact(attempt)) {
      if (time > lastInboundTime) {
        lastInboundTime = time;
        lastInboundAt = attempt.at;
      }
      continue;
    }
    if (attempt.channel === 'call') calls += 1;
    if (attempt.channel === 'text') texts += 1;
    if (time > lastTime) {
      lastTime = time;
      lastContactedAt = attempt.at;
    }
  }

  const summary: LeadContactSummary = { calls, texts, lastContactedAt };
  if (lastInboundAt) summary.lastInboundAt = lastInboundAt;
  return summary;
}

/** Short label for a GHL-reported entry: "Outbound · voicemail · 0:42" */
export function describeContactOutcome(attempt: LeadContactAttempt): string {
  const parts = [isInboundContact(attempt) ? 'Inbound' : 'Outbound'];
  if (attempt.status) parts.push(attempt.status.replace(/-/g, ' '));
  if (attempt.durationSeconds) {
    const minutes = Math.floor(attempt.durationSeconds / 60);
    parts.push(`${minutes}:${String(attempt.durationSeconds % 60).padStart(2, '0')}`);
  }
  return parts.join(' · ');
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
