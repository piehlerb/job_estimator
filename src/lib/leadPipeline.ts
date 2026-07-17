export const LEAD_STAGES = [
  'New',
  'Contact Attempted',
  'Engaged',
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
  | 'appointment.completed';

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
  phone?: string;
  email?: string;
  address?: string;
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

export interface NormalizedGhlWebhook {
  eventType: GhlWebhookEventType;
  dedupeKey: string;
  lead: NormalizedWebhookLead;
  appointment?: NormalizedWebhookAppointment;
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

function normalizeIso(value?: string): string | undefined {
  if (!value) return undefined;
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

export function normalizeGhlWebhook(payload: Record<string, unknown>): NormalizedGhlWebhook {
  const eventType = normalizeEventType(readFirstString(payload, [
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
  ]));

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
  const lead: NormalizedWebhookLead = {
    ghlContactId,
    name: normalizeWhitespace(fullName || joinedName),
    phone: normalizePhone(readFirstString(payload, ['phone', 'phone_number', 'phoneNumber', 'contact.phone'])),
    email: normalizeEmail(readFirstString(payload, ['email', 'contact.email'])),
    address: normalizeWhitespace(readFirstString(payload, ['address', 'full_address', 'fullAddress', 'location.fullAddress'])),
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
        ])),
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

  const dedupeKey = readFirstString(payload, ['dedupe_key', 'dedupeKey', 'event_id', 'eventId']) || buildDedupeKey({
    eventType,
    ghlContactId,
    ghlAppointmentId,
    scheduledStartAt,
  });
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
    sourceWorkflow: normalizeWhitespace(readFirstString(payload, ['workflow', 'workflow_name', 'workflowName', 'workflow.name'])),
    reviewReasons,
  };
}
