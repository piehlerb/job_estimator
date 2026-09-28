-- Migration: Add referral_associates and referral_services tables
-- Referral associates are third-party contacts who refer work. Services are
-- reusable tags (e.g. "Plumber", "Realtor") that can be attached to multiple
-- associates. New services can be created on the fly.

-- =====================================================
-- REFERRAL SERVICES TABLE (tag pool)
-- =====================================================
CREATE TABLE IF NOT EXISTS referral_services (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_referral_services_user_id ON referral_services(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_services_org_id ON referral_services(org_id);
CREATE INDEX IF NOT EXISTS idx_referral_services_updated_at ON referral_services(user_id, updated_at);

ALTER TABLE referral_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own referral services" ON referral_services;
CREATE POLICY "Users can manage their own referral services"
  ON referral_services
  FOR ALL
  USING (
    user_id = auth.uid()
    OR (
      org_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_members.org_id = referral_services.org_id
          AND organization_members.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR (
      org_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_members.org_id = referral_services.org_id
          AND organization_members.user_id = auth.uid()
      )
    )
  );

-- =====================================================
-- REFERRAL ASSOCIATES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS referral_associates (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  company TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  service_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_referral_associates_user_id ON referral_associates(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_associates_org_id ON referral_associates(org_id);
CREATE INDEX IF NOT EXISTS idx_referral_associates_updated_at ON referral_associates(user_id, updated_at);

ALTER TABLE referral_associates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own referral associates" ON referral_associates;
CREATE POLICY "Users can manage their own referral associates"
  ON referral_associates
  FOR ALL
  USING (
    user_id = auth.uid()
    OR (
      org_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_members.org_id = referral_associates.org_id
          AND organization_members.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR (
      org_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_members.org_id = referral_associates.org_id
          AND organization_members.user_id = auth.uid()
      )
    )
  );

COMMENT ON TABLE referral_services IS 'Reusable service tags that can be attached to referral associates';
COMMENT ON TABLE referral_associates IS 'Third-party contacts who refer work; tagged with one or more services';
COMMENT ON COLUMN referral_associates.service_ids IS 'Array of referral_services.id values this associate provides';
