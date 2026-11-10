export const LEAD_STAGES = [
  'New',
  'Contact Attempted',
  'Engaged',
  'Call Booked',
  'Estimate Booked',
  'Estimate Completed',
  'Quoted',
  'Won',
  'Lost',
  'Disqualified',
] as const;

export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_DISPOSITION_REASONS = [
  'Not Interested',
  'Out of Territory',
  'Wrong Service',
  'Bad Contact Info',
  'Duplicate',
  'Spam',
  'Unresponsive',
  'Price/Budget',
  'Timing',
  'Other',
] as const;

export type LeadDispositionReason = (typeof LEAD_DISPOSITION_REASONS)[number];

export type GhlWebhookEventType =
  | 'lead.created'
  | 'appointment.booked'
  | 'appointment.rescheduled'
  | 'appointment.canceled'
  | 'appointment.completed'
  | 'contact.call'
  | 'contact.text';

export type LeadAppointmentStatus = 'booked' | 'rescheduled' | 'canceled' | 'no_show' | 'completed';

export interface DedupeKeyInput {
  eventType: string;
  ghlContactId?: string;
  ghlAppointmentId?: string;
  scheduledStartAt?: string;
  fallbackId?: string;
}

export interface NormalizedWebhookLead {
  ghlContactId?: string;
  name?: string;
  /**
   * The first name as sent, falling back to the leading word of the full name.
   * Read only by the anonymous-lead filter — the stored row keeps `name` whole.
   */
  firstName?: string;
  phone?: string;
  email?: string;
  /** The flattened address as it arrived. Kept as the record of what GHL sent. */
  address?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  /**
   * Only ever 'A' here: GHL's discrete fields are source-of-truth structure, not
   * a parse. A partial set is left untiered so the client-side parser still
   * visits the row.
   */
  addressParseTier?: 'A';
  source?: string;
  campaign?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
}

export interface NormalizedWebhookAppointment {
  ghlAppointmentId?: string;
  scheduledStartAt?: string;
  scheduledEndAt?: string;
  status: LeadAppointmentStatus;
  calendarName?: string;
  assignedUser?: string;
}

/** A call or text between the business and a lead, as reported by GHL. */
export interface NormalizedWebhookContact {
  channel: 'call' | 'text';
  /** 'outbound' is the business reaching out — an attempt. 'inbound' is the lead. */
  direction: 'outbound' | 'inbound';
  /** When it happened, if the payload says. The receiver falls back to arrival time. */
  at?: string;
  /** GHL's outcome, lower-cased: completed, voicemail, no-answer, delivered, ... */
  status?: string;
  /** Calls only, whole seconds. */
  durationSeconds?: number;
  ghlMessageId?: string;
}

export interface NormalizedGhlWebhook {
  eventType: GhlWebhookEventType;
  dedupeKey: string;
  lead: NormalizedWebhookLead;
  appointment?: NormalizedWebhookAppointment;
  /** Present on 'contact.call' and 'contact.text' events only. */
  contact?: NormalizedWebhookContact;
  sourceWorkflow?: string;
  reviewReasons: string[];
}

function readNestedValue(payload: Record<string, unknown>, key: string): unknown {
  return key.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined;
    return (current as Record<string, unknown>)[segment];
  }, payload);
}

function readFirstString(payload: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = key.includes('.') ? readNestedValue(payload, key) : payload[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (typeof value === 'number') {
      return String(value);
    }
  }
  return undefined;
}

/** The address-bearing columns of a leads row, as stored. */
export interface LeadAddressColumns {
  address: string | null;
  street: string | null;
  street2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  address_parse_tier: string | null;
  address_verified_at: string | null;
}

export type IncomingLeadAddress = Pick<
  NormalizedWebhookLead,
  'address' | 'street' | 'city' | 'state' | 'zip' | 'addressParseTier'
>;

function addressPartsConflict(incoming?: string, existing?: string | null): boolean {
  if (!incoming?.trim() || !existing?.trim()) return false;
  return incoming.trim().toLowerCase() !== existing.trim().toLowerCase();
}

/**
 * Decide which address columns a webhook may write, returning a patch to apply
 * over the stored row. An empty patch means "leave everything as it is".
 *
 * Two rules, and the second one is the subtle one:
 *
 * 1. The ratchet. A row that a human has confirmed (address_verified_at set) or
 *    hand-entered (tier 'M') is never touched. Without this the next webhook
 *    reverts the correction and the cleanup worklist never empties.
 *
 * 2. The group is atomic when the address *changes*. Merging these columns
 *    independently is what makes a partial payload dangerous: GHL frequently
 *    sends city/state/postal_code with no address1, so field-by-field merging
 *    would keep the previous address's street and weld it onto the new town —
 *    then stamp tier 'A' on the result, telling everything downstream that the
 *    row is deterministic and needs no review. So if any of city/state/zip
 *    contradicts what is stored, the whole projection is replaced and absent
 *    members become null (street2 included, since a unit number belongs to the
 *    address it came with). A blank field beats a confidently wrong one.
 *
 * When nothing contradicts — the same address arriving again, or a first address
 * for a bare row — fields fill in individually, which is safe precisely because
 * there is no disagreement to resolve.
 */
export function resolveLeadAddressMerge(
  existing: Partial<LeadAddressColumns> | null,
  incoming: IncomingLeadAddress
): Partial<LeadAddressColumns> {
  const ratcheted =
    Boolean(existing?.address_verified_at) || existing?.address_parse_tier === 'M';
  if (ratcheted) return {};

  const addressChanged =
    addressPartsConflict(incoming.city, existing?.city) ||
    addressPartsConflict(incoming.state, existing?.state) ||
    addressPartsConflict(incoming.zip, existing?.zip);

  if (addressChanged) {
    return {
      // The raw string that came with the superseded address is not kept: it
      // describes a place this lead is no longer at. Full history stays in
      // ghl_webhook_events.raw_payload.
      address: incoming.address || null,
      street: incoming.street || null,
      street2: null,
      city: incoming.city || null,
      state: incoming.state || null,
      zip: incoming.zip || null,
      address_parse_tier: incoming.addressParseTier || null,
    };
  }

  const patch: Partial<LeadAddressColumns> = {};
  const fill = (
    key: keyof LeadAddressColumns,
    existingValue: string | null | undefined,
    incomingValue: string | undefined
  ) => {
    if (shouldOverwriteLeadValue(existingValue || undefined, incomingValue)) {
      patch[key] = incomingValue || null;
    }
  };

  fill('address', existing?.address, incoming.address);
  fill('street', existing?.street, incoming.street);
  fill('city', existing?.city, incoming.city);
  fill('state', existing?.state, incoming.state);
  fill('zip', existing?.zip, incoming.zip);
  fill('address_parse_tier', existing?.address_parse_tier, incoming.addressParseTier);
  return patch;
}

function normalizeEventType(value?: string): GhlWebhookEventType {
  const normalized = value?.trim().toLowerCase().replace(/_/g, '.');
  switch (normalized) {
    case 'appointment.booked':
    case 'appointment.created':
      return 'appointment.booked';
    case 'appointment.rescheduled':
    case 'appointment.updated':
      return 'appointment.rescheduled';
    case 'appointment.canceled':
    case 'appointment.cancelled':
      return 'appointment.canceled';
    case 'appointment.completed':
    case 'estimate.completed':
      return 'appointment.completed';
    case 'lead.created':
    case 'contact.created':
    default:
      return 'lead.created';
  }
}

function normalizeWhitespace(value?: string): string | undefined {
  const normalized = value?.replace(/\s+/g, ' ').trim();
  return normalized || undefined;
}

export function normalizePhone(value?: string): string | undefined {
  const digits = value?.replace(/\D/g, '');
  if (!digits) return undefined;
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
}

export function normalizeEmail(value?: string): string | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized || undefined;
}

/**
 * Two-letter state codes only.
 *
 * Payloads carry 'Nh' alongside 'NH', so casing is normalized. Anything longer
 * than two letters (a spelled-out state) is dropped rather than guessed at: the
 * raw address is still stored, so the address parser can recover it later, and
 * writing an unvalidated value here would be rejected by the leads.state CHECK
 * constraint — which fails the whole batched sync upsert, not just one row.
 */
export function normalizeStateCode(value?: string): string | undefined {
  const candidate = value?.trim();
  // Test for two ASCII letters BEFORE upper-casing: some single characters widen
  // to two under toUpperCase ('ß' -> 'SS', the 'ﬅ' ligature -> 'ST'), which would
  // otherwise manufacture a real-looking state code out of one junk character.
  if (!candidate || !/^[A-Za-z]{2}$/.test(candidate)) return undefined;
  return candidate.toUpperCase();
}

/**
 * Five-digit US ZIP. ZIP+4 collapses to its prefix.
 *
 * Short values are left-padded, which is recovery rather than guessing: JSON
 * numbers cannot carry a leading zero, so a numeric postal_code of 3885 can only
 * ever have meant 03885. That case matters disproportionately here — every ME and
 * NH ZIP begins with 0, so without the pad a single upstream change from string
 * to number would silently drop every in-territory ZIP.
 */
export function normalizeZipCode(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 5) return digits;
  if (digits.length === 9) return digits.slice(0, 5);
  // Pad only a wholly numeric value. Digits salvaged from mixed text are not a
  // ZIP and must never be padded into one — a Canadian 'K1A 0B1' reduces to
  // '101', which would otherwise become the very real ZIP 00101.
  if (digits.length < 5 && /^[0-9]+$/.test(trimmed)) return digits.padStart(5, '0');
  return undefined;
}

/**
 * Timezone assumed for naive appointment times when the payload doesn't name one.
 * GHL sends the booking timezone on every appointment webhook we've seen, so this
 * is only a backstop; Eastern matches the business (see lib/dateUtils.ts).
 */
const DEFAULT_APPOINTMENT_TIMEZONE = 'America/New_York';

/** Accept a payload timezone only if the runtime recognizes it; otherwise fall back. */
function resolveTimeZone(value?: string): string {
  const candidate = value?.trim();
  if (!candidate) return DEFAULT_APPOINTMENT_TIMEZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate });
    return candidate;
  } catch {
    return DEFAULT_APPOINTMENT_TIMEZONE;
  }
}

/** True when a datetime string already carries a UTC marker or numeric offset. */
function hasExplicitOffset(value: string): boolean {
  return /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value.trim());
}

/** Offset in ms between `timeZone` and UTC at the given instant (positive east of UTC). */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);

  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const hour = read('hour') % 24; // en-US hour12:false renders midnight as 24
  const asUtc = Date.UTC(read('year'), read('month') - 1, read('day'), hour, read('minute'), read('second'));
  return asUtc - instant.getTime();
}

/**
 * Interpret a naive "YYYY-MM-DDTHH:mm:ss" wall time as belonging to `timeZone`
 * and return the corresponding UTC instant.
 *
 * Runs the offset lookup twice: the first pass uses the wall time read as UTC to
 * pick an offset, the second re-checks it at the resulting instant so times near
 * a DST transition land on the correct side of the change.
 */
function naiveWallTimeToUtc(value: string, timeZone: string): Date | null {
  const wallAsUtc = Date.parse(`${value.trim().replace(' ', 'T')}Z`);
  if (Number.isNaN(wallAsUtc)) return null;

  const firstPass = wallAsUtc - zoneOffsetMs(new Date(wallAsUtc), timeZone);
  const refinedOffset = zoneOffsetMs(new Date(firstPass), timeZone);
  return new Date(wallAsUtc - refinedOffset);
}

/**
 * Normalize a webhook datetime to a UTC ISO string.
 *
 * Values that already carry an offset are trusted as-is. Naive values (GHL sends
 * `calendar.startTime` as bare local wall time) are interpreted in `timeZone`
 * rather than in whatever timezone the runtime happens to use — the edge function
 * runs in UTC, which silently shifted every appointment by the Eastern offset.
 */
function normalizeIso(value?: string, timeZone: string = DEFAULT_APPOINTMENT_TIMEZONE): string | undefined {
  if (!value) return undefined;

  if (!hasExplicitOffset(value)) {
    const zoned = naiveWallTimeToUtc(value, timeZone);
    if (zoned) return zoned.toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

function appointmentStatusForEvent(eventType: GhlWebhookEventType): LeadAppointmentStatus {
  switch (eventType) {
    case 'appointment.rescheduled':
      return 'rescheduled';
    case 'appointment.canceled':
      return 'canceled';
    case 'appointment.completed':
      return 'completed';
    case 'appointment.booked':
    default:
      return 'booked';
  }
}

export function buildDedupeKey(input: DedupeKeyInput): string {
  const parts = [
    input.eventType,
    input.ghlContactId,
    input.ghlAppointmentId,
    input.scheduledStartAt,
    input.fallbackId,
  ].filter((part): part is string => Boolean(part?.trim()));

  return parts.join(':');
}

export function shouldOverwriteLeadValue(existing: string | undefined, incoming: string | undefined): boolean {
  if (!incoming?.trim()) return false;
  if (!existing?.trim()) return true;
  return existing.trim() !== incoming.trim();
}

/**
 * Values that arrive in the name field in place of a name. GHL names a contact
 * from whatever the channel hands it, so an unattended call shows up as the
 * caller ID or a literal placeholder rather than as an empty field.
 */
const PLACEHOLDER_NAMES = new Set([
  'unknown',
  'unknown caller',
  'unknown name',
  'no name',
  'noname',
  'not provided',
  'na',
  'n/a',
  'none',
  'null',
  'undefined',
  'anonymous',
  'caller',
  'new lead',
  'lead',
]);

/** Whether a first name is a name a person gave, rather than a stand-in for one. */
export function looksLikeRealFirstName(value?: string): boolean {
  const candidate = value?.replace(/\s+/g, ' ').trim().toLowerCase();
  if (!candidate) return false;
  // A caller ID standing in for a name has no letters in it: '+1 603-555-0100'.
  if (!/[a-z]/.test(candidate)) return false;
  return !PLACEHOLDER_NAMES.has(candidate.replace(/\./g, ''));
}

export const IGNORED_ANONYMOUS_LEAD_REASON =
  'Ignored: inbound lead has no first name (likely a spam call).';

/**
 * Whether an event should be recorded but not turned into a lead.
 *
 * Every inbound call opens a GHL contact, so without a filter the leads list
 * fills with robocalls and wrong numbers that never gave a name. Requiring a
 * first name before a lead row is created removes those, and the rule is narrow
 * on purpose:
 *
 * - only 'lead.created'. An appointment means a person booked time on the
 *   calendar, whatever their contact record happens to be called.
 * - only when no lead row exists yet. A lead already being worked must still
 *   receive later events, even ones carrying no name.
 *
 * Nothing is discarded either way: the payload is already stored in
 * ghl_webhook_events, marked 'ignored', so a lead filtered out by mistake is
 * still there to be found.
 */
export function shouldIgnoreAnonymousLead(
  normalized: Pick<NormalizedGhlWebhook, 'eventType' | 'lead'>,
  hasExistingLead: boolean
): boolean {
  if (hasExistingLead) return false;
  if (normalized.eventType !== 'lead.created') return false;
  return !looksLikeRealFirstName(normalized.lead.firstName);
}

export function nextLeadStageForEvent(currentStage: LeadStage | undefined, eventType: GhlWebhookEventType): LeadStage {
  if (currentStage === 'Won' || currentStage === 'Lost' || currentStage === 'Disqualified') {
    return currentStage;
  }

  switch (eventType) {
    case 'appointment.booked':
    case 'appointment.rescheduled':
      return 'Estimate Booked';
    case 'appointment.completed':
      return 'Estimate Completed';
    case 'appointment.canceled':
      return currentStage || 'New';
    case 'lead.created':
    default:
      return currentStage || 'New';
  }
}

export function stageForLinkedJobStatus(status: 'Won' | 'Lost' | 'Pending' | 'Verbal'): LeadStage {
  if (status === 'Won') return 'Won';
  if (status === 'Lost') return 'Lost';
  return 'Quoted';
}

/**
 * How a payload relates to call/text tracking.
 *
 * - 'none': not a message event; handle it as a lead or appointment event.
 * - 'unsupported': a GHL message on a channel that is not tracked (email, chat,
 *   social DMs). The receiver acknowledges these without storing them — a single
 *   email campaign would otherwise write one event row per recipient.
 * - 'contact': a call or text to record on the lead.
 */
export type GhlMessageClassification =
  | { kind: 'none' }
  | { kind: 'unsupported'; messageType: string }
  | { kind: 'contact'; contact: NormalizedWebhookContact };

const CALL_MESSAGE_TYPES = new Set(['call', 'voicemail', 'custom_call', 'ivr_call']);
const TEXT_MESSAGE_TYPES = new Set(['sms', 'custom_sms', 'text']);

const CALL_EVENT_NAMES = new Set(['contact.call', 'call', 'call.logged', 'call.status', 'call.details']);
const TEXT_EVENT_NAMES = new Set(['contact.text', 'contact.sms', 'text', 'sms', 'message.sms', 'message.text']);

function normalizeDirection(value?: string): 'outbound' | 'inbound' | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized.startsWith('in')) return 'inbound';
  if (normalized.startsWith('out')) return 'outbound';
  return undefined;
}

/** A timestamp only if it parses; a merge field GHL left unfilled must not become the time. */
function parsedIsoOrUndefined(value?: string): string | undefined {
  if (!value) return undefined;
  const normalized = normalizeIso(value);
  return normalized && !Number.isNaN(new Date(normalized).getTime()) ? normalized : undefined;
}

function normalizeContactStatus(value?: string): string | undefined {
  const normalized = value?.trim().toLowerCase().replace(/[\s_]+/g, '-');
  // An unfilled merge field arrives as the literal '{{...}}' text.
  if (!normalized || normalized.includes('{{')) return undefined;
  return normalized.slice(0, 40);
}

/**
 * Recognize a call or text in either shape GHL sends it:
 *
 * 1. App webhooks (`type: 'OutboundMessage' | 'InboundMessage'`), which fire for
 *    every message on the location — calls and texts sent by hand included — and
 *    carry the channel in `messageType`.
 * 2. Workflow webhooks, identified by an `event_type` custom-data value of
 *    'contact.call' or 'contact.text' with an optional `direction`, the same way
 *    the lead and appointment workflows identify themselves.
 */
export function classifyGhlMessage(payload: Record<string, unknown>): GhlMessageClassification {
  const appEventType = readFirstString(payload, ['type'])?.toLowerCase();
  const isAppMessage = appEventType === 'outboundmessage' || appEventType === 'inboundmessage';

  let channel: 'call' | 'text' | undefined;
  let direction: 'outbound' | 'inbound' | undefined;

  if (isAppMessage) {
    const rawMessageType = readFirstString(payload, ['messageType', 'messageTypeString', 'message_type']) || '';
    const messageType = rawMessageType.toLowerCase().replace(/^type_/, '');
    if (CALL_MESSAGE_TYPES.has(messageType)) channel = 'call';
    else if (TEXT_MESSAGE_TYPES.has(messageType)) channel = 'text';
    else return { kind: 'unsupported', messageType: rawMessageType || 'unknown' };

    // The event name is the fallback: `direction` is absent on some payloads.
    direction =
      normalizeDirection(readFirstString(payload, ['direction'])) ||
      (appEventType === 'inboundmessage' ? 'inbound' : 'outbound');
  } else {
    let eventName = readFirstString(payload, [
      'event_type',
      'eventType',
      'customData.event_type',
      'customData.eventType',
    ])?.toLowerCase().replace(/_/g, '.');
    if (!eventName) return { kind: 'none' };

    // 'contact.call.outbound' and 'contact.text.inbound' carry the direction inline.
    const suffix = eventName.match(/\.(inbound|outbound)$/)?.[1];
    if (suffix) eventName = eventName.slice(0, -(suffix.length + 1));

    if (CALL_EVENT_NAMES.has(eventName)) channel = 'call';
    else if (TEXT_EVENT_NAMES.has(eventName)) channel = 'text';
    else return { kind: 'none' };

    direction =
      normalizeDirection(suffix) ||
      normalizeDirection(readFirstString(payload, [
        'customData.direction',
        'direction',
        'message.direction',
        'customData.call_direction',
        'customData.message_direction',
      ])) ||
      'outbound';
  }

  const duration = Number(readFirstString(payload, [
    'callDuration',
    'call_duration',
    'customData.call_duration',
    'customData.duration',
    'meta.callDuration',
  ]));

  return {
    kind: 'contact',
    contact: {
      channel,
      direction,
      at: parsedIsoOrUndefined(readFirstString(payload, [
        'dateAdded',
        'date_added',
        'customData.occurred_at',
        'customData.occurredAt',
        'occurred_at',
      ])),
      // callStatus is the outcome (voicemail, no-answer); `status` alone reads
      // 'completed' for a call that merely finished ringing out to voicemail.
      status: normalizeContactStatus(readFirstString(payload, [
        'callStatus',
        'call_status',
        'customData.call_status',
        'customData.status',
        'meta.callStatus',
        'status',
        'message.status',
      ])),
      durationSeconds: channel === 'call' && Number.isFinite(duration) && duration >= 0
        ? Math.round(duration)
        : undefined,
      ghlMessageId: readFirstString(payload, [
        'messageId',
        'message_id',
        'customData.message_id',
        'customData.messageId',
        'message.id',
      ]),
    },
  };
}

/**
 * The contact_log element written for a webhook-reported call or text. Keys are
 * snake_case because the app's sync layer converts JSON keys in both directions
 * (`duration_seconds` here is `durationSeconds` on LeadContactAttempt).
 *
 * `id` is derived from the GHL message id, so a later webhook for the same
 * message (a call moving from ringing to completed) replaces the entry rather
 * than adding a second attempt.
 */
export function buildContactLogEntry(
  contact: NormalizedWebhookContact,
  fallbackId: string,
  nowIso: string
): Record<string, string | number> {
  const entry: Record<string, string | number> = {
    id: `ghl_${contact.ghlMessageId || fallbackId}`.replace(/[^a-zA-Z0-9_-]/g, '_'),
    channel: contact.channel,
    at: contact.at || nowIso,
    direction: contact.direction,
    source: 'ghl',
  };
  if (contact.status) entry.status = contact.status;
  if (contact.durationSeconds !== undefined) entry.duration_seconds = contact.durationSeconds;
  return entry;
}

export const IGNORED_UNKNOWN_CONTACT_REASON =
  'Ignored: call/text for a GHL contact that is not a lead here.';

export function normalizeGhlWebhook(payload: Record<string, unknown>): NormalizedGhlWebhook {
  const message = classifyGhlMessage(payload);
  const contact = message.kind === 'contact' ? message.contact : undefined;
  const eventType: GhlWebhookEventType = contact
    ? (contact.channel === 'call' ? 'contact.call' : 'contact.text')
    : normalizeEventType(readFirstString(payload, [
        'event_type',
        'eventType',
        'type',
        'customData.event_type',
        'customData.eventType',
      ]));
  const ghlContactId = readFirstString(payload, [
    'contact_id',
    'contactId',
    'ghl_contact_id',
    'ghlContactId',
    'contact.id',
  ]);
  const ghlAppointmentId = readFirstString(payload, [
    'appointment_id',
    'appointmentId',
    'calendar_event_id',
    'calendarEventId',
    'appointment.id',
    'triggerData.appointment.id',
    'triggerData.id',
    'calendar.appointmentId',
    'calendar.appointment_id',
  ]);
  // GHL sends appointment times as bare wall time plus the booking timezone in a
  // separate field; both are needed to pin down the actual instant.
  const appointmentTimeZone = resolveTimeZone(readFirstString(payload, [
    'calendar.selectedTimezone',
    'calendar.timezone',
    'selected_timezone',
    'selectedTimezone',
    'timezone',
    'appointment.timezone',
    'triggerData.timezone',
    'contact.timezone',
  ]));
  const scheduledStartAt = normalizeIso(readFirstString(payload, [
    'scheduled_start_at',
    'scheduledStartAt',
    'appointment_start',
    'appointmentStart',
    'start_time',
    'startTime',
    'appointment.startTime',
    'appointment.start_time',
    'triggerData.startTime',
    'triggerData.start_time',
    'calendar.startTime',
    'calendar.start_time',
  ]), appointmentTimeZone);

  const firstName = readFirstString(payload, ['first_name', 'firstName']);
  const lastName = readFirstString(payload, ['last_name', 'lastName']);
  const fullName = readFirstString(payload, [
    'full_name',
    'fullName',
    'name',
    'contact_name',
    'contactName',
    'contact.fullName',
    'contact.name',
  ]);
  const joinedName = normalizeWhitespace([firstName, lastName].filter(Boolean).join(' '));
  const resolvedName = normalizeWhitespace(fullName || joinedName);
  // Fall back to the leading word of the full name: some workflows send only a
  // combined name, and dropping those leads would be worse than the odd surname
  // read as a first name.
  const resolvedFirstName = normalizeWhitespace(firstName) || resolvedName?.split(' ')[0];

  // GHL sends the address both flattened (`full_address`) and as discrete fields.
  // The discrete fields are read directly rather than recovered by parsing the
  // flattened string — parsing structure we were handed would only add a way to
  // get it wrong.
  //
  // Verified against the 237 payloads stored between 2026-06-23 and 2026-08-10:
  // the keys are top-level and snake_case, the `contact` sub-object carries no
  // address fields at all, and `address1` is the only street source — when it is
  // absent `full_address` holds just "City, ST 12345" (2-25 chars), so there is
  // no street hiding in it. The camelCase spellings below are defensive only.
  const street = normalizeWhitespace(readFirstString(payload, [
    'address1',
    'address_1',
    'addressLine1',
    'address_line_1',
    'street',
    'contact.address1',
  ]));
  const city = normalizeWhitespace(readFirstString(payload, ['city', 'contact.city']));
  const state = normalizeStateCode(readFirstString(payload, ['state', 'contact.state']));
  const zip = normalizeZipCode(readFirstString(payload, [
    'postal_code',
    'postalCode',
    'zip',
    'zip_code',
    'contact.postal_code',
    'contact.postalCode',
  ]));

  const lead: NormalizedWebhookLead = {
    ghlContactId,
    name: resolvedName,
    firstName: resolvedFirstName,
    phone: normalizePhone(readFirstString(payload, ['phone', 'phone_number', 'phoneNumber', 'contact.phone'])),
    email: normalizeEmail(readFirstString(payload, ['email', 'contact.email'])),
    address: normalizeWhitespace(readFirstString(payload, ['address', 'full_address', 'fullAddress', 'location.fullAddress'])),
    street,
    city,
    state,
    zip,
    addressParseTier: zip && city && state ? 'A' : undefined,
    source: normalizeWhitespace(readFirstString(payload, [
      'contact_source',
      'contact.source',
      'contact.lead_source',
      'contact.leadSource',
      'source',
      'lead_source',
      'leadSource',
    ])),
    campaign: normalizeWhitespace(readFirstString(payload, [
      'campaign',
      'campaign_name',
      'campaignName',
      'contact.attributionSource.campaign',
      'contact.lastAttributionSource.campaign',
    ])),
    utmSource: normalizeWhitespace(readFirstString(payload, ['utm_source', 'utmSource'])),
    utmMedium: normalizeWhitespace(readFirstString(payload, ['utm_medium', 'utmMedium'])),
    utmCampaign: normalizeWhitespace(readFirstString(payload, ['utm_campaign', 'utmCampaign'])),
    utmContent: normalizeWhitespace(readFirstString(payload, ['utm_content', 'utmContent'])),
  };

  const appointment = eventType.startsWith('appointment.')
    ? {
        ghlAppointmentId,
        scheduledStartAt,
        scheduledEndAt: normalizeIso(readFirstString(payload, [
          'scheduled_end_at',
          'scheduledEndAt',
          'appointment_end',
          'appointmentEnd',
          'end_time',
          'endTime',
          'appointment.endTime',
          'appointment.end_time',
          'triggerData.endTime',
          'triggerData.end_time',
          'calendar.endTime',
          'calendar.end_time',
        ]), appointmentTimeZone),
        status: appointmentStatusForEvent(eventType),
        calendarName: normalizeWhitespace(readFirstString(payload, [
          'calendar_name',
          'calendarName',
          'appointment.calendarName',
          'triggerData.calendarName',
          'triggerData.calendar.name',
          'calendar.calendarName',
          'calendar.name',
        ])),
        assignedUser: normalizeWhitespace(readFirstString(payload, [
          'assigned_user',
          'assignedUser',
          'owner',
          'appointment.assignedUser',
          'triggerData.assignedUser',
          'calendar.created_by',
        ])),
      }
    : undefined;

  const dedupeKey = readFirstString(payload, ['dedupe_key', 'dedupeKey', 'event_id', 'eventId']) || (contact
    ? buildDedupeKey({
        eventType,
        ghlContactId,
        // A retry of the same delivery collapses; a status change on the same
        // message (ringing -> completed) is a new event and updates the entry.
        // Without a message id nothing identifies the call, so every delivery
        // is kept rather than risk merging two real calls.
        fallbackId: contact.ghlMessageId
          ? [contact.ghlMessageId, contact.direction, contact.status, contact.durationSeconds]
              .filter((part) => part !== undefined && part !== '')
              .join(':')
          : `${contact.direction}:${contact.at || crypto.randomUUID()}`,
      })
    : buildDedupeKey({
        eventType,
        ghlContactId,
        ghlAppointmentId,
        scheduledStartAt,
      }));
  const reviewReasons: string[] = [];

  if (!lead.ghlContactId && !lead.phone && !lead.email) {
    reviewReasons.push('Missing lead identity: expected GHL contact id, phone, or email.');
  }
  if (appointment && !appointment.ghlAppointmentId && !appointment.scheduledStartAt) {
    reviewReasons.push('Missing appointment identity: expected appointment id or scheduled start.');
  }

  return {
    eventType,
    dedupeKey,
    lead,
    appointment,
    contact,
    sourceWorkflow: normalizeWhitespace(readFirstString(payload, ['workflow', 'workflow_name', 'workflowName', 'workflow.name'])),
    reviewReasons,
  };
}
