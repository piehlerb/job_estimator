import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import {
  normalizeGhlWebhook,
  nextLeadStageForEvent,
  shouldOverwriteLeadValue,
  type NormalizedGhlWebhook,
} from '../_shared/leadPipeline.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-ghl-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type SourceRow = {
  id: string;
  user_id: string | null;
  org_id: string | null;
  is_active: boolean;
};

type LeadRow = {
  id: string;
  user_id: string | null;
  org_id: string | null;
  ghl_contact_id: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  source: string | null;
  campaign: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  first_seen_at: string;
  last_event_at: string | null;
  stage: string;
  created_at: string;
  updated_at: string;
};

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return toHex(digest);
}

function pickIncomingSecret(req: Request, payload: Record<string, unknown>): string | undefined {
  const headerSecret = req.headers.get('x-ghl-webhook-secret')?.trim();
  if (headerSecret) return headerSecret;

  const customData = payload.customData;
  const candidates = [
    payload.webhook_secret,
    payload['x-ghl-webhook-secret'],
    customData && typeof customData === 'object' && !Array.isArray(customData)
      ? (customData as Record<string, unknown>).webhook_secret
      : undefined,
    customData && typeof customData === 'object' && !Array.isArray(customData)
      ? (customData as Record<string, unknown>)['x-ghl-webhook-secret']
      : undefined,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return undefined;
}

function stringOrNull(value: string | undefined): string | null {
  return value?.trim() ? value.trim() : null;
}

function errorToMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch (_stringifyError) {
    return 'Unknown processing error';
  }
}

function buildLeadId(source: SourceRow, normalized: NormalizedGhlWebhook): string {
  const identity =
    normalized.lead.ghlContactId ||
    normalized.lead.phone ||
    normalized.lead.email ||
    normalized.dedupeKey;

  return `ghl_${source.id}_${identity}`.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function sourceScopedLeadsQuery(supabase: ReturnType<typeof createClient>, source: SourceRow) {
  const query = supabase.from('leads').select('*');
  if (source.org_id) {
    return query.eq('org_id', source.org_id);
  }
  return query.is('org_id', null).eq('user_id', source.user_id);
}

function leadLookupQuery(
  supabase: ReturnType<typeof createClient>,
  source: SourceRow,
  normalized: NormalizedGhlWebhook
) {
  const baseQuery = sourceScopedLeadsQuery(supabase, source);

  if (normalized.lead.ghlContactId) {
    return baseQuery.eq('ghl_contact_id', normalized.lead.ghlContactId).maybeSingle();
  }

  if (normalized.lead.phone) {
    return baseQuery.eq('phone', normalized.lead.phone).maybeSingle();
  }

  if (normalized.lead.email) {
    return baseQuery.eq('email', normalized.lead.email).maybeSingle();
  }

  return baseQuery.eq('id', buildLeadId(source, normalized)).maybeSingle();
}

function mergeLeadRow(
  existing: LeadRow | null,
  source: SourceRow,
  normalized: NormalizedGhlWebhook,
  nowIso: string
): LeadRow {
  const merged: LeadRow = {
    id: existing?.id || buildLeadId(source, normalized),
    user_id: existing?.user_id || source.user_id,
    org_id: existing?.org_id || source.org_id,
    ghl_contact_id: existing?.ghl_contact_id || stringOrNull(normalized.lead.ghlContactId),
    name: existing?.name || null,
    phone: existing?.phone || null,
    email: existing?.email || null,
    address: existing?.address || null,
    source: existing?.source || null,
    campaign: existing?.campaign || null,
    utm_source: existing?.utm_source || null,
    utm_medium: existing?.utm_medium || null,
    utm_campaign: existing?.utm_campaign || null,
    utm_content: existing?.utm_content || null,
    first_seen_at: existing?.first_seen_at || nowIso,
    last_event_at: nowIso,
    stage: nextLeadStageForEvent(existing?.stage as never, normalized.eventType),
    created_at: existing?.created_at || nowIso,
    updated_at: nowIso,
  };

  const fields = [
    ['name', normalized.lead.name],
    ['phone', normalized.lead.phone],
    ['email', normalized.lead.email],
    ['address', normalized.lead.address],
    ['source', normalized.lead.source],
    ['campaign', normalized.lead.campaign],
    ['utm_source', normalized.lead.utmSource],
    ['utm_medium', normalized.lead.utmMedium],
    ['utm_campaign', normalized.lead.utmCampaign],
    ['utm_content', normalized.lead.utmContent],
  ] as const;

  const existingValues = existing as Record<string, string | null | undefined> | null;
  const mergedValues = merged as unknown as Record<string, string | null>;

  for (const [key, incoming] of fields) {
    if (shouldOverwriteLeadValue(existingValues?.[key] || undefined, incoming)) {
      mergedValues[key] = incoming || null;
    }
  }

  return merged;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { error: 'Webhook service is not configured' });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch (_error) {
    return jsonResponse(400, { error: 'Invalid JSON payload' });
  }

  const incomingSecret = pickIncomingSecret(req, payload);
  if (!incomingSecret) {
    return jsonResponse(401, { error: 'Missing webhook secret' });
  }

  const secretHash = await sha256Hex(incomingSecret);
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: source, error: sourceError } = await supabase
    .from('ghl_webhook_sources')
    .select('id,user_id,org_id,is_active')
    .eq('secret_hash', secretHash)
    .eq('is_active', true)
    .maybeSingle();

  if (sourceError) {
    console.error('Failed to look up webhook source', sourceError);
    return jsonResponse(500, { error: 'Unable to validate webhook source' });
  }

  if (!source) {
    return jsonResponse(401, { error: 'Invalid webhook secret' });
  }

  const webhookSource = source as SourceRow;
  const normalized = normalizeGhlWebhook(payload);
  const nowIso = new Date().toISOString();

  const { data: eventRow, error: eventError } = await supabase
    .from('ghl_webhook_events')
    .insert({
      user_id: webhookSource.user_id,
      org_id: webhookSource.org_id,
      webhook_source_id: webhookSource.id,
      event_type: normalized.eventType,
      dedupe_key: normalized.dedupeKey,
      received_at: nowIso,
      processing_status: 'pending',
      raw_payload: payload,
      source_workflow: normalized.sourceWorkflow || null,
    })
    .select('id')
    .single();

  if (eventError) {
    const code = 'code' in eventError ? eventError.code : undefined;
    if (code === '23505') {
      return jsonResponse(200, { ok: true, duplicate: true });
    }

    console.error('Failed to record webhook event', eventError);
    return jsonResponse(500, { error: 'Unable to record webhook event' });
  }

  if (normalized.reviewReasons.length > 0) {
    await supabase
      .from('ghl_webhook_events')
      .update({
        processing_status: 'needs_review',
        processed_at: nowIso,
        error_message: normalized.reviewReasons.join(' '),
      })
      .eq('id', eventRow.id);

    return jsonResponse(202, { ok: true, needsReview: true, reasons: normalized.reviewReasons });
  }

  try {
    const { data: existingLead, error: leadLookupError } = await leadLookupQuery(
      supabase,
      webhookSource,
      normalized
    );

    if (leadLookupError) {
      throw leadLookupError;
    }

    const leadRow = mergeLeadRow(existingLead as LeadRow | null, webhookSource, normalized, nowIso);
    const { error: leadError } = await supabase.from('leads').upsert(leadRow, { onConflict: 'id' });

    if (leadError) {
      throw leadError;
    }

    if (normalized.appointment) {
      const appointmentId =
        normalized.appointment.ghlAppointmentId ||
        `${leadRow.id}_${normalized.appointment.scheduledStartAt || normalized.dedupeKey}`.replace(/[^a-zA-Z0-9_-]/g, '_');

      const { error: appointmentError } = await supabase.from('lead_appointments').upsert({
        id: `ghl_${webhookSource.id}_${appointmentId}`.replace(/[^a-zA-Z0-9_-]/g, '_'),
        lead_id: leadRow.id,
        user_id: webhookSource.user_id,
        org_id: webhookSource.org_id,
        ghl_appointment_id: stringOrNull(normalized.appointment.ghlAppointmentId),
        scheduled_start_at: stringOrNull(normalized.appointment.scheduledStartAt),
        scheduled_end_at: stringOrNull(normalized.appointment.scheduledEndAt),
        status: normalized.appointment.status,
        calendar_name: stringOrNull(normalized.appointment.calendarName),
        assigned_user: stringOrNull(normalized.appointment.assignedUser),
        created_from_event_id: normalized.eventType === 'appointment.booked' ? eventRow.id : null,
        last_event_id: eventRow.id,
        created_at: nowIso,
        updated_at: nowIso,
      }, { onConflict: 'id' });

      if (appointmentError) {
        throw appointmentError;
      }
    }

    await supabase
      .from('ghl_webhook_events')
      .update({
        processing_status: 'processed',
        processed_at: nowIso,
      })
      .eq('id', eventRow.id);

    return jsonResponse(200, { ok: true, leadId: leadRow.id });
  } catch (error) {
    console.error('Failed to process webhook event', error);
    const message = errorToMessage(error);

    await supabase
      .from('ghl_webhook_events')
      .update({
        processing_status: 'failed',
        processed_at: new Date().toISOString(),
        error_message: message,
      })
      .eq('id', eventRow.id);

    return jsonResponse(500, { error: 'Webhook processing failed' });
  }
});
