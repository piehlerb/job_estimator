-- Lead pipeline: a "Call Booked" stage, and a log of call/text attempts.

-- "Call Booked" sits between Engaged and Estimate Booked: a phone call has been
-- scheduled with the lead, but no on-site estimate yet.
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_stage_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_stage_check CHECK (stage = ANY (ARRAY[
  'New'::text, 'Contact Attempted'::text, 'Engaged'::text, 'Call Booked'::text,
  'Estimate Booked'::text, 'Estimate Completed'::text, 'Quoted'::text,
  'Won'::text, 'Lost'::text, 'Disqualified'::text
]));

-- Each element is {"id": text, "channel": "call" | "text", "at": timestamptz text}.
-- Call/text counts and the last-contacted date are derived from it in the app.
-- The ghl-webhook upsert names its columns explicitly and leaves this one alone.
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS contact_log jsonb;

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_contact_log_is_array;
ALTER TABLE public.leads ADD CONSTRAINT leads_contact_log_is_array
  CHECK (contact_log IS NULL OR jsonb_typeof(contact_log) = 'array');

COMMENT ON COLUMN public.leads.contact_log IS
  'Call and text attempts made to this lead: [{id, channel: call|text, at}]';
