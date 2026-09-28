-- Migration: Add Multi-User Organizations
-- Adds organizations, members, and invitation tables.
-- Extends all shared data tables with an optional org_id column.
-- Updates RLS policies to allow org members to access shared data.

-- =====================================================
-- HELPER FUNCTION: generate random invite code
-- =====================================================
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ORGANIZATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ORGANIZATION MEMBERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  access_level TEXT NOT NULL DEFAULT 'full' CHECK (access_level IN ('full', 'inventory_only')),
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON organization_members(org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON organization_members(user_id);

-- =====================================================
-- ORGANIZATION INVITATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  invite_code TEXT UNIQUE NOT NULL DEFAULT generate_invite_code(),
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  accepted_by UUID REFERENCES auth.users(id),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_invitations_org_id ON organization_invitations(org_id);
CREATE INDEX IF NOT EXISTS idx_org_invitations_code ON organization_invitations(invite_code);

-- =====================================================
-- ADD org_id TO ALL SHARED DATA TABLES
-- =====================================================
ALTER TABLE systems          ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);
ALTER TABLE pricing_variables ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);
ALTER TABLE costs            ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);
ALTER TABLE laborers         ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);
ALTER TABLE chip_blends      ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);
ALTER TABLE base_coat_colors ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);
ALTER TABLE jobs             ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);
ALTER TABLE chip_inventory   ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);
ALTER TABLE topcoat_inventory   ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);
ALTER TABLE basecoat_inventory  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);
ALTER TABLE misc_inventory      ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);
ALTER TABLE customers        ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);
ALTER TABLE products         ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);

-- Handle pricing table (added via earlier migration, may or may not exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pricing') THEN
    ALTER TABLE pricing ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);
  END IF;
END $$;

-- =====================================================
-- FIX UNIQUE CONSTRAINTS ON SINGLETON TABLES
-- The original UNIQUE(user_id) prevents org data sharing.
-- Replace with partial unique indexes so:
--   - Personal records: unique by user_id (where org_id IS NULL)
--   - Org records: unique by org_id (where org_id IS NOT NULL)
-- =====================================================
ALTER TABLE costs             DROP CONSTRAINT IF EXISTS costs_user_id_key;
ALTER TABLE topcoat_inventory  DROP CONSTRAINT IF EXISTS topcoat_inventory_user_id_key;
ALTER TABLE basecoat_inventory DROP CONSTRAINT IF EXISTS basecoat_inventory_user_id_key;
ALTER TABLE misc_inventory     DROP CONSTRAINT IF EXISTS misc_inventory_user_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS costs_user_personal_unique
  ON costs(user_id) WHERE org_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS costs_org_unique
  ON costs(org_id) WHERE org_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS topcoat_inventory_user_personal_unique
  ON topcoat_inventory(user_id) WHERE org_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS topcoat_inventory_org_unique
  ON topcoat_inventory(org_id) WHERE org_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS basecoat_inventory_user_personal_unique
  ON basecoat_inventory(user_id) WHERE org_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS basecoat_inventory_org_unique
  ON basecoat_inventory(org_id) WHERE org_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS misc_inventory_user_personal_unique
  ON misc_inventory(user_id) WHERE org_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS misc_inventory_org_unique
  ON misc_inventory(org_id) WHERE org_id IS NOT NULL;

-- =====================================================
-- INDEXES FOR org_id QUERIES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_systems_org_id         ON systems(org_id)          WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pricing_vars_org_id    ON pricing_variables(org_id) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_costs_org_id           ON costs(org_id)            WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_laborers_org_id        ON laborers(org_id)         WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chip_blends_org_id     ON chip_blends(org_id)      WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_base_coat_colors_org_id ON base_coat_colors(org_id) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_org_id            ON jobs(org_id)             WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chip_inv_org_id        ON chip_inventory(org_id)   WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_topcoat_inv_org_id     ON topcoat_inventory(org_id) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_basecoat_inv_org_id    ON basecoat_inventory(org_id) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_misc_inv_org_id        ON misc_inventory(org_id)   WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_org_id       ON customers(org_id)        WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_org_id        ON products(org_id)         WHERE org_id IS NOT NULL;

-- =====================================================
-- RLS HELPER FUNCTIONS
-- =====================================================
CREATE OR REPLACE FUNCTION is_org_member(p_org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE org_id = p_org_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_org_admin(p_org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE org_id = p_org_id AND user_id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =====================================================
-- ENABLE RLS ON NEW TABLES
-- =====================================================
ALTER TABLE organizations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES FOR organizations
-- =====================================================
DROP POLICY IF EXISTS "Members can view their org"     ON organizations;
DROP POLICY IF EXISTS "Users can create orgs"          ON organizations;
DROP POLICY IF EXISTS "Admins can update their org"    ON organizations;

CREATE POLICY "Members can view their org"
  ON organizations FOR SELECT
  USING (is_org_member(id) OR auth.uid() = created_by);

CREATE POLICY "Users can create orgs"
  ON organizations FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can update their org"
  ON organizations FOR UPDATE
  USING (is_org_admin(id))
  WITH CHECK (is_org_admin(id));

-- =====================================================
-- RLS POLICIES FOR organization_members
-- =====================================================
DROP POLICY IF EXISTS "Members can view org members"    ON organization_members;
DROP POLICY IF EXISTS "Users can insert themselves"     ON organization_members;
DROP POLICY IF EXISTS "Admins can insert members"       ON organization_members;
DROP POLICY IF EXISTS "Admins can update member roles"  ON organization_members;
DROP POLICY IF EXISTS "Admins or self can remove"       ON organization_members;

CREATE POLICY "Members can view org members"
  ON organization_members FOR SELECT
  USING (is_org_member(org_id));

-- Allow a user to insert their own membership (for invite acceptance)
-- or an admin to add any member
CREATE POLICY "Insert member"
  ON organization_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR is_org_admin(org_id)
  );

CREATE POLICY "Admins can update member roles"
  ON organization_members FOR UPDATE
  USING (is_org_admin(org_id))
  WITH CHECK (is_org_admin(org_id));

CREATE POLICY "Admins or self can remove"
  ON organization_members FOR DELETE
  USING (is_org_admin(org_id) OR auth.uid() = user_id);

-- =====================================================
-- RLS POLICIES FOR organization_invitations
-- =====================================================
DROP POLICY IF EXISTS "Members can view org invitations"  ON organization_invitations;
DROP POLICY IF EXISTS "Public can lookup by code"         ON organization_invitations;
DROP POLICY IF EXISTS "Admins can create invitations"     ON organization_invitations;
DROP POLICY IF EXISTS "Admins can update invitations"     ON organization_invitations;
DROP POLICY IF EXISTS "Admins can revoke invitations"     ON organization_invitations;

-- Members see their org's invitations (for management UI)
CREATE POLICY "Members can view org invitations"
  ON organization_invitations FOR SELECT
  USING (is_org_member(org_id) OR invite_code IS NOT NULL);

CREATE POLICY "Admins can create invitations"
  ON organization_invitations FOR INSERT
  WITH CHECK (is_org_admin(org_id));

CREATE POLICY "Admins can update invitations"
  ON organization_invitations FOR UPDATE
  USING (is_org_admin(org_id) OR auth.uid() = accepted_by)
  WITH CHECK (is_org_admin(org_id) OR auth.uid() = accepted_by);

CREATE POLICY "Admins can revoke invitations"
  ON organization_invitations FOR DELETE
  USING (is_org_admin(org_id));

-- =====================================================
-- UPDATE RLS POLICIES FOR DATA TABLES
-- Replace strict user_id-only policies with org-aware policies.
-- =====================================================

-- Drop existing policies that we are replacing
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'systems', 'pricing_variables', 'costs', 'laborers',
        'chip_blends', 'base_coat_colors', 'jobs', 'chip_inventory',
        'topcoat_inventory', 'basecoat_inventory', 'misc_inventory',
        'customers', 'products'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;

-- Macro to create org-aware policies for a table
-- SELECT/UPDATE: user owns it OR user is org member and record belongs to org
-- INSERT: user must set their own user_id (org_id handled by app)
-- DELETE: user owns it OR user is org admin

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'systems', 'pricing_variables', 'costs', 'laborers',
    'chip_blends', 'base_coat_colors', 'jobs', 'chip_inventory',
    'topcoat_inventory', 'basecoat_inventory', 'misc_inventory',
    'customers', 'products'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY "Org-aware select" ON %I FOR SELECT USING (
         auth.uid() = user_id
         OR (org_id IS NOT NULL AND is_org_member(org_id))
       )', tbl);

    EXECUTE format(
      'CREATE POLICY "Org-aware insert" ON %I FOR INSERT WITH CHECK (
         auth.uid() = user_id
       )', tbl);

    EXECUTE format(
      'CREATE POLICY "Org-aware update" ON %I FOR UPDATE
       USING (
         auth.uid() = user_id
         OR (org_id IS NOT NULL AND is_org_member(org_id))
       )
       WITH CHECK (
         auth.uid() = user_id
         OR (org_id IS NOT NULL AND is_org_member(org_id))
       )', tbl);

    EXECUTE format(
      'CREATE POLICY "Org-aware delete" ON %I FOR DELETE USING (
         auth.uid() = user_id
         OR (org_id IS NOT NULL AND is_org_admin(org_id))
       )', tbl);
  END LOOP;
END $$;

-- Also update pricing table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pricing') THEN
    DROP POLICY IF EXISTS "Org-aware select" ON pricing;
    DROP POLICY IF EXISTS "Org-aware insert" ON pricing;
    DROP POLICY IF EXISTS "Org-aware update" ON pricing;
    DROP POLICY IF EXISTS "Org-aware delete" ON pricing;

    EXECUTE '
      CREATE POLICY "Org-aware select" ON pricing FOR SELECT USING (
        auth.uid() = user_id OR (org_id IS NOT NULL AND is_org_member(org_id))
      )';
    EXECUTE '
      CREATE POLICY "Org-aware insert" ON pricing FOR INSERT WITH CHECK (
        auth.uid() = user_id
      )';
    EXECUTE '
      CREATE POLICY "Org-aware update" ON pricing FOR UPDATE
      USING (auth.uid() = user_id OR (org_id IS NOT NULL AND is_org_member(org_id)))
      WITH CHECK (auth.uid() = user_id OR (org_id IS NOT NULL AND is_org_member(org_id)))';
    EXECUTE '
      CREATE POLICY "Org-aware delete" ON pricing FOR DELETE USING (
        auth.uid() = user_id OR (org_id IS NOT NULL AND is_org_admin(org_id))
      )';
  END IF;
END $$;

-- =====================================================
-- RPC: Migrate all user data to an organization
-- Called after creating or joining an org to tag all
-- existing personal records with the new org_id.
-- Uses SECURITY DEFINER to bypass RLS (safe: only updates
-- records where user_id = auth.uid()).
-- For singleton tables, skips migration if org already
-- has a record (avoids UNIQUE constraint violation).
-- =====================================================
CREATE OR REPLACE FUNCTION migrate_user_data_to_org(p_org_id UUID)
RETURNS void AS $$
BEGIN
  -- Verify caller is a member of this org
  IF NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE org_id = p_org_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  -- Non-singleton tables: migrate all personal records
  UPDATE systems          SET org_id = p_org_id WHERE user_id = auth.uid() AND org_id IS NULL;
  UPDATE pricing_variables SET org_id = p_org_id WHERE user_id = auth.uid() AND org_id IS NULL;
  UPDATE laborers         SET org_id = p_org_id WHERE user_id = auth.uid() AND org_id IS NULL;
  UPDATE chip_blends      SET org_id = p_org_id WHERE user_id = auth.uid() AND org_id IS NULL;
  UPDATE base_coat_colors SET org_id = p_org_id WHERE user_id = auth.uid() AND org_id IS NULL;
  UPDATE jobs             SET org_id = p_org_id WHERE user_id = auth.uid() AND org_id IS NULL;
  UPDATE chip_inventory   SET org_id = p_org_id WHERE user_id = auth.uid() AND org_id IS NULL;
  UPDATE customers        SET org_id = p_org_id WHERE user_id = auth.uid() AND org_id IS NULL;
  UPDATE products         SET org_id = p_org_id WHERE user_id = auth.uid() AND org_id IS NULL;

  -- Singleton tables: only migrate if org doesn't already have one
  UPDATE costs SET org_id = p_org_id
    WHERE user_id = auth.uid()
      AND org_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM costs WHERE org_id = p_org_id);

  UPDATE topcoat_inventory SET org_id = p_org_id
    WHERE user_id = auth.uid()
      AND org_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM topcoat_inventory WHERE org_id = p_org_id);

  UPDATE basecoat_inventory SET org_id = p_org_id
    WHERE user_id = auth.uid()
      AND org_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM basecoat_inventory WHERE org_id = p_org_id);

  UPDATE misc_inventory SET org_id = p_org_id
    WHERE user_id = auth.uid()
      AND org_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM misc_inventory WHERE org_id = p_org_id);

  -- Handle pricing table if it exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pricing') THEN
    EXECUTE '
      UPDATE pricing SET org_id = $1
        WHERE user_id = auth.uid()
          AND org_id IS NULL
          AND NOT EXISTS (SELECT 1 FROM pricing WHERE org_id = $1)'
    USING p_org_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
