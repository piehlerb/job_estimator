-- Migration: Add GHL lead webhook attribution tables
-- Stores GHL webhook source configuration, raw inbound events,
-- normalized leads, and appointment lifecycle records.

-- =====================================================
-- WEBHOOK SOURCES
-- =====================================================
CREATE TABLE IF NOT EXISTS ghl_webhook_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ghl_webhook_sources_user_id ON ghl_webhook_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_ghl_webhook_sources_org_id ON ghl_webhook_sources(org_id);
CREATE INDEX IF NOT EXISTS idx_ghl_webhook_sources_active ON ghl_webhook_sources(is_active) WHERE is_active = TRUE;

DROP TRIGGER IF EXISTS update_ghl_webhook_sources_updated_at ON ghl_webhook_sources;
CREATE TRIGGER update_ghl_webhook_sources_updated_at BEFORE UPDATE ON ghl_webhook_sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE ghl_webhook_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own GHL webhook sources" ON ghl_webhook_sources;
CREATE POLICY "Users can manage their own GHL webhook sources"
  ON ghl_webhook_sources
  FOR ALL
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (
      org_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_members.org_id = ghl_webhook_sources.org_id
          AND organization_members.user_id = (SELECT auth.uid())
      )
    )
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR (
      org_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_members.org_id = ghl_webhook_sources.org_id
          AND organization_members.user_id = (SELECT auth.uid())
      )
    )
  );

-- =====================================================
-- RAW WEBHOOK EVENTS
-- =====================================================
CREATE TABLE IF NOT EXISTS ghl_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id),
  webhook_source_id UUID NOT NULL REFERENCES ghl_webhook_sources(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'lead.created',
    'appointment.booked',
    'appointment.rescheduled',
    'appointment.canceled',
    'appointment.completed'
  )),
  dedupe_key TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processing_status TEXT NOT NULL DEFAULT 'pending' CHECK (processing_status IN (
    'pending',
    'processed',
    'failed',
    'needs_review',
    'ignored'
  )),
  error_message TEXT,
  raw_payload JSONB NOT NULL,
  source_workflow TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ghl_webhook_events_source_dedupe
  ON ghl_webhook_events(webhook_source_id, dedupe_key);
CREATE INDEX IF NOT EXISTS idx_ghl_webhook_events_user_id ON ghl_webhook_events(user_id);
CREATE INDEX IF NOT EXISTS idx_ghl_webhook_events_org_id ON ghl_webhook_events(org_id);
CREATE INDEX IF NOT EXISTS idx_ghl_webhook_events_status ON ghl_webhook_events(processing_status);
CREATE INDEX IF NOT EXISTS idx_ghl_webhook_events_received_at ON ghl_webhook_events(received_at);

DROP TRIGGER IF EXISTS update_ghl_webhook_events_updated_at ON ghl_webhook_events;
CREATE TRIGGER update_ghl_webhook_events_updated_at BEFORE UPDATE ON ghl_webhook_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE ghl_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own GHL webhook events" ON ghl_webhook_events;
CREATE POLICY "Users can view their own GHL webhook events"
  ON ghl_webhook_events
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (
      org_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_members.org_id = ghl_webhook_events.org_id
          AND organization_members.user_id = (SELECT auth.uid())
      )
    )
  );

-- =====================================================
-- NORMALIZED LEADS
-- =====================================================
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id),
  ghl_contact_id TEXT,
  name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  source TEXT,
  campaign TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_event_at TIMESTAMPTZ,
  stage TEXT NOT NULL DEFAULT 'New' CHECK (stage IN (
    'New',
    'Contact Attempted',
    'Engaged',
    'Estimate Booked',
    'Estimate Completed',
    'Quoted',
    'Won',
    'Lost',
    'Disqualified'
  )),
  disposition_reason TEXT CHECK (
    disposition_reason IS NULL OR disposition_reason IN (
      'Not Interested',
      'Out of Territory',
      'Wrong Service',
      'Bad Contact Info',
      'Duplicate',
      'Spam',
      'Unresponsive',
      'Price/Budget',
      'Timing',
      'Other'
    )
  ),
  disposition_notes TEXT,
  closed_at TIMESTAMPTZ,
  customer_id TEXT,
  deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_org_ghl_contact_id
  ON leads(org_id, ghl_contact_id)
  WHERE org_id IS NOT NULL AND ghl_contact_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_user_ghl_contact_id
  ON leads(user_id, ghl_contact_id)
  WHERE org_id IS NULL AND ghl_contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_org_id ON leads(org_id);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(user_id, stage);
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(user_id, source);
CREATE INDEX IF NOT EXISTS idx_leads_updated_at ON leads(user_id, updated_at);

DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own leads" ON leads;
CREATE POLICY "Users can manage their own leads"
  ON leads
  FOR ALL
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (
      org_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_members.org_id = leads.org_id
          AND organization_members.user_id = (SELECT auth.uid())
      )
    )
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR (
      org_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_members.org_id = leads.org_id
          AND organization_members.user_id = (SELECT auth.uid())
      )
    )
  );

-- =====================================================
-- LEAD APPOINTMENTS
-- =====================================================
CREATE TABLE IF NOT EXISTS lead_appointments (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id),
  lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  ghl_appointment_id TEXT,
  scheduled_start_at TIMESTAMPTZ,
  scheduled_end_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'booked' CHECK (status IN (
    'booked',
    'rescheduled',
    'canceled',
    'no_show',
    'completed'
  )),
  calendar_name TEXT,
  assigned_user TEXT,
  created_from_event_id UUID REFERENCES ghl_webhook_events(id),
  last_event_id UUID REFERENCES ghl_webhook_events(id),
  deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_appointments_org_ghl_id
  ON lead_appointments(org_id, ghl_appointment_id)
  WHERE org_id IS NOT NULL AND ghl_appointment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_appointments_user_ghl_id
  ON lead_appointments(user_id, ghl_appointment_id)
  WHERE org_id IS NULL AND ghl_appointment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lead_appointments_lead_id ON lead_appointments(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_appointments_scheduled_start_at ON lead_appointments(scheduled_start_at);
CREATE INDEX IF NOT EXISTS idx_lead_appointments_updated_at ON lead_appointments(user_id, updated_at);

DROP TRIGGER IF EXISTS update_lead_appointments_updated_at ON lead_appointments;
CREATE TRIGGER update_lead_appointments_updated_at BEFORE UPDATE ON lead_appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE lead_appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own lead appointments" ON lead_appointments;
CREATE POLICY "Users can manage their own lead appointments"
  ON lead_appointments
  FOR ALL
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (
      org_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_members.org_id = lead_appointments.org_id
          AND organization_members.user_id = (SELECT auth.uid())
      )
    )
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR (
      org_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_members.org_id = lead_appointments.org_id
          AND organization_members.user_id = (SELECT auth.uid())
      )
    )
  );

-- =====================================================
-- JOB LINK
-- =====================================================
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS lead_id TEXT REFERENCES leads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_lead_id ON jobs(lead_id) WHERE lead_id IS NOT NULL;

-- =====================================================
-- EXPLICIT API GRANTS
-- =====================================================
GRANT SELECT ON public.ghl_webhook_sources TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ghl_webhook_sources TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ghl_webhook_sources TO service_role;

GRANT SELECT ON public.ghl_webhook_events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ghl_webhook_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ghl_webhook_events TO service_role;

GRANT SELECT ON public.leads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO service_role;

GRANT SELECT ON public.lead_appointments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_appointments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_appointments TO service_role;

COMMENT ON TABLE ghl_webhook_sources IS 'Configured GHL webhook sources scoped to a user or organization';
COMMENT ON TABLE ghl_webhook_events IS 'Raw immutable-ish GHL webhook event ledger with processing status';
COMMENT ON TABLE leads IS 'Normalized lead attribution and funnel state records';
COMMENT ON TABLE lead_appointments IS 'Estimate appointment lifecycle records linked to leads';
COMMENT ON COLUMN jobs.lead_id IS 'Optional link to the originating lead attribution record';
