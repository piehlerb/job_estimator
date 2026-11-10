-- Calls and texts reported by GoHighLevel are recorded on the lead.
--
-- They land in leads.contact_log beside the attempts logged by hand in the app,
-- so the existing counts, "last contacted" filter and any future reminder rules
-- read one list. A webhook-written element looks like:
--
--   {"id": "ghl_<message id>", "channel": "call" | "text", "at": timestamptz text,
--    "direction": "outbound" | "inbound", "source": "ghl",
--    "status": text (optional), "duration_seconds": int (optional, calls)}
--
-- Hand-logged elements keep their shape ({id, channel, at}) and read as outbound.

-- 1. The webhook event log accepts the two new event types.
ALTER TABLE public.ghl_webhook_events
  DROP CONSTRAINT IF EXISTS ghl_webhook_events_event_type_check,
  ADD CONSTRAINT ghl_webhook_events_event_type_check CHECK (event_type = ANY (ARRAY[
    'lead.created'::text, 'appointment.booked'::text, 'appointment.rescheduled'::text,
    'appointment.canceled'::text, 'appointment.completed'::text,
    'contact.call'::text, 'contact.text'::text
  ]));

-- 2. Atomic append, called by the ghl-webhook edge function.
--
-- One UPDATE, so two webhooks arriving together (a call and the text sent right
-- after it) cannot overwrite each other the way a read-then-write would. An
-- element with the same id is replaced in place of being added again: GHL
-- reports a call more than once as its status settles.
--
-- Returns false when the lead does not exist.
CREATE OR REPLACE FUNCTION public.record_lead_contact(
  p_lead_id text,
  p_entry jsonb,
  p_mark_attempted boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_now timestamptz := now();
BEGIN
  IF p_entry IS NULL OR jsonb_typeof(p_entry) <> 'object' OR COALESCE(p_entry->>'id', '') = '' THEN
    RAISE EXCEPTION 'record_lead_contact: entry must be a JSON object with an id';
  END IF;

  UPDATE public.leads
  SET
    contact_log = COALESCE((
      SELECT jsonb_agg(existing.element ORDER BY existing.position)
      FROM jsonb_array_elements(COALESCE(contact_log, '[]'::jsonb))
        WITH ORDINALITY AS existing(element, position)
      WHERE existing.element->>'id' IS DISTINCT FROM p_entry->>'id'
    ), '[]'::jsonb) || jsonb_build_array(p_entry),
    stage = CASE WHEN p_mark_attempted AND stage = 'New' THEN 'Contact Attempted' ELSE stage END,
    last_event_at = v_now,
    -- Strictly newer than what any device holds, so the next pull replaces the
    -- device's copy even if its clock runs ahead (ties go to the device).
    updated_at = GREATEST(v_now, updated_at + interval '1 millisecond')
  WHERE id = p_lead_id;

  RETURN FOUND;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_lead_contact(text, jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_lead_contact(text, jsonb, boolean) TO service_role;

-- 3. App saves cannot drop webhook-recorded attempts.
--
-- The app syncs whole lead rows, last write wins. A device that has not yet
-- pulled a webhook-recorded call still holds the older contact_log, and its
-- next save of that lead (a stage change, even) would push that older list over
-- the newer one and silently erase the call. So when an update would remove
-- elements whose source is 'ghl', they are put back. Hand-logged elements stay
-- fully editable and deletable.
--
-- updated_at is nudged forward when that happens so the pushing device, which
-- wins timestamp ties, pulls the repaired row back on its next sync.
CREATE OR REPLACE FUNCTION public.preserve_ghl_contact_log()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_missing jsonb;
BEGIN
  IF OLD.contact_log IS NULL OR NEW.contact_log IS NOT DISTINCT FROM OLD.contact_log THEN
    RETURN NEW;
  END IF;

  SELECT jsonb_agg(previous.element ORDER BY previous.position)
  INTO v_missing
  FROM jsonb_array_elements(OLD.contact_log) WITH ORDINALITY AS previous(element, position)
  WHERE previous.element->>'source' = 'ghl'
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(NEW.contact_log, '[]'::jsonb)) AS incoming(element)
      WHERE incoming.element->>'id' = previous.element->>'id'
    );

  IF v_missing IS NOT NULL THEN
    NEW.contact_log := COALESCE(NEW.contact_log, '[]'::jsonb) || v_missing;
    NEW.updated_at := NEW.updated_at + interval '1 millisecond';
  END IF;

  RETURN NEW;
END;
$function$;

-- Named to sort after sync_lww_guard_leads (BEFORE triggers fire in name order):
-- a stale push the guard rejects never reaches this one.
CREATE OR REPLACE TRIGGER sync_preserve_ghl_contact_log
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.preserve_ghl_contact_log();

COMMENT ON COLUMN public.leads.contact_log IS
  'Calls and texts with this lead: [{id, channel: call|text, at, direction?, source?: ghl, status?, duration_seconds?}]. Elements with source ghl are written by the ghl-webhook function and survive app saves.';
