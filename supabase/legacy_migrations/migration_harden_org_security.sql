-- Migration: Harden organization security
--
-- Fixes four problems found in a security review:
--
-- 1. Anyone could join any organization as an admin.
--    The "Insert member" policy only checked auth.uid() = user_id, so any
--    signed-in user could insert their own membership row into any org with
--    role = 'admin'. Org ids were easy to find because every invitation
--    (code + org_id) was readable by every signed-in user
--    ("... OR invite_code IS NOT NULL").
--    Fix: no direct inserts into organization_members / organizations.
--    Joining goes through accept_invite(), which takes role and permissions
--    from the invitation; creating goes through create_organization().
--    Invitations are readable by org admins only.
--
-- 2. Per-member permissions were enforced only in the UI.
--    Fix: every org-scoped table's INSERT/UPDATE policy now requires the
--    member's effective permissions (organization_members.permissions, or
--    the access_level fallback — same rules as resolvePermissions() in
--    src/lib/permissions.ts) to allow writing that table. Admins always
--    pass. Reads stay open to all org members: estimates and inventory
--    allocations need jobs/pricing/costs even for members who cannot open
--    those pages.
--
-- 3. Rows could be pushed into another org, or re-owned.
--    INSERT checked only user_id, never org_id; UPDATE let a row's owner
--    move it into any org. Fix: writing an org row requires being a member
--    of that org with write permission, and a trigger keeps user_id fixed
--    after insert (sync pushes stamp the editor's user_id; the trigger
--    silently keeps the original, like preserve_org_id does for org_id).
--    Ex-members no longer see org rows they created.
--
-- 4. Accepting an invite never marked it accepted.
--    The UPDATE policy required auth.uid() = accepted_by, which is NULL
--    until the update runs, so the update matched nothing and invite codes
--    stayed reusable until they expired. accept_invite() now marks the
--    invitation accepted in the same transaction.
--
-- Also fixes the organizations SELECT policy, whose invite clause compared
-- organization_invitations.org_id with organization_invitations.id (the
-- unqualified "id" bound to the inner table), so it never matched.
--
-- Requires the client from the same release (joinOrganizationByCode and
-- createOrganization call the new RPCs). Safe to re-run.

BEGIN;

-- =====================================================
-- 1. ORGANIZATIONS, MEMBERS, INVITATIONS
-- =====================================================

DROP POLICY IF EXISTS "Members can view their org" ON organizations;
CREATE POLICY "Members can view their org"
  ON organizations FOR SELECT
  USING (is_org_member(id) OR auth.uid() = created_by);

-- Orgs are created only through create_organization()
DROP POLICY IF EXISTS "Users can create orgs" ON organizations;

-- Members are added only through create_organization() / accept_invite()
DROP POLICY IF EXISTS "Insert member" ON organization_members;
DROP POLICY IF EXISTS "Users can insert themselves" ON organization_members;
DROP POLICY IF EXISTS "Admins can insert members" ON organization_members;

-- Invite codes grant membership (possibly admin), so only admins see them
DROP POLICY IF EXISTS "Members can view org invitations" ON organization_invitations;
DROP POLICY IF EXISTS "Admins can view org invitations" ON organization_invitations;
CREATE POLICY "Admins can view org invitations"
  ON organization_invitations FOR SELECT
  USING (is_org_admin(org_id));

-- Acceptance happens inside accept_invite()
DROP POLICY IF EXISTS "Admins can update invitations" ON organization_invitations;
CREATE POLICY "Admins can update invitations"
  ON organization_invitations FOR UPDATE
  USING (is_org_admin(org_id))
  WITH CHECK (is_org_admin(org_id));

CREATE OR REPLACE FUNCTION create_organization(p_name TEXT)
RETURNS organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_email TEXT;
  v_org   organizations;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'Organization name is required.';
  END IF;

  IF EXISTS (SELECT 1 FROM organization_members WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'You already belong to an organization.';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  INSERT INTO organizations (name, created_by)
  VALUES (btrim(p_name), v_uid)
  RETURNING * INTO v_org;

  INSERT INTO organization_members (org_id, user_id, email, role)
  VALUES (v_org.id, v_uid, COALESCE(v_email, ''), 'admin');

  RETURN v_org;
END;
$$;

CREATE OR REPLACE FUNCTION accept_invite(p_invite_code TEXT)
RETURNS organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_email  TEXT;
  v_invite organization_invitations;
  v_org    organizations;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Lock the invitation so two people can't redeem it at once
  SELECT * INTO v_invite
  FROM organization_invitations
  WHERE invite_code = upper(btrim(p_invite_code))
    AND accepted_at IS NULL
    AND expires_at > NOW()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invite code.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM organization_members
    WHERE org_id = v_invite.org_id AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'You are already a member of this organization.';
  END IF;

  IF EXISTS (SELECT 1 FROM organization_members WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'Leave your current organization before joining another.';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  INSERT INTO organization_members (org_id, user_id, email, role, invited_by, permissions)
  VALUES (
    v_invite.org_id, v_uid, COALESCE(v_email, ''),
    v_invite.role, v_invite.invited_by, v_invite.permissions
  );

  UPDATE organization_invitations
  SET accepted_by = v_uid, accepted_at = NOW()
  WHERE id = v_invite.id;

  SELECT * INTO v_org FROM organizations WHERE id = v_invite.org_id;
  RETURN v_org;
END;
$$;

REVOKE ALL ON FUNCTION create_organization(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION accept_invite(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION create_organization(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_invite(TEXT) TO authenticated;

-- No longer used by the client; keep it for older clients but not for anon
REVOKE EXECUTE ON FUNCTION lookup_invite_by_code(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION lookup_invite_by_code(TEXT) TO authenticated;

-- =====================================================
-- 2. PERMISSION CHECK FOR ORG DATA WRITES
-- =====================================================
-- True when the caller is a member of p_org_id whose effective permissions
-- grant at least one of p_features. Feature names match MemberPermissions
-- keys; 'jobs' means jobs = 'write'. Mirrors resolvePermissions():
--   admin                              -> everything
--   permissions JSON set               -> use it
--   else access_level 'inventory_only' -> inventory only
--   else                               -> everything
CREATE OR REPLACE FUNCTION org_can_write(p_org_id UUID, p_features TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM organization_members m
    WHERE m.org_id = p_org_id
      AND m.user_id = auth.uid()
      AND (
        m.role = 'admin'
        OR (m.permissions IS NULL AND m.access_level <> 'inventory_only')
        OR (m.permissions IS NULL AND m.access_level = 'inventory_only'
            AND 'inventory' = ANY (p_features))
        OR (m.permissions IS NOT NULL AND EXISTS (
              SELECT 1 FROM unnest(p_features) AS f
              WHERE (f = 'jobs' AND m.permissions ->> 'jobs' = 'write')
                 OR (f <> 'jobs' AND m.permissions -> f = 'true'::jsonb)
            ))
      )
  );
$$;

REVOKE ALL ON FUNCTION org_can_write(UUID, TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION org_can_write(UUID, TEXT[]) TO authenticated;

-- =====================================================
-- 3. KEEP user_id FIXED AFTER INSERT
-- =====================================================
CREATE OR REPLACE FUNCTION preserve_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Sync pushes stamp the editing member's user_id; keep the original owner
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    NEW.user_id := OLD.user_id;
  END IF;
  RETURN NEW;
END;
$$;

-- =====================================================
-- 2 + 3. ORG-SCOPED DATA TABLE POLICIES
-- =====================================================
-- Each table lists the features that may write it. The lists follow where
-- the app writes each table (e.g. the job form saves customers, links
-- leads and deducts inventory, so jobs = 'write' can write those too).
--
--   SELECT: own personal rows, or any row of an org you belong to
--   INSERT: user_id is you, and either personal or org write permission
--   UPDATE: own personal rows, or org rows with write permission
--   DELETE: own personal rows, or org rows as an org admin
DO $$
DECLARE
  spec RECORD;
  p RECORD;
  personal TEXT := '(org_id IS NULL AND user_id = auth.uid())';
  can_write TEXT;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('jobs',                ARRAY['jobs']),
      ('customers',           ARRAY['customers', 'jobs']),
      ('leads',               ARRAY['customers', 'reporting', 'jobs']),
      ('lead_appointments',   ARRAY['customers', 'reporting', 'jobs']),
      ('systems',             ARRAY['chipSystems']),
      ('chip_blends',         ARRAY['chipBlends', 'inventory', 'jobs']),
      ('base_coat_colors',    ARRAY['settings']),
      ('laborers',            ARRAY['laborers']),
      ('costs',               ARRAY['costs']),
      ('pricing',             ARRAY['pricing', 'settings']),
      ('pricing_variables',   ARRAY['pricing']),
      ('products',            ARRAY['products']),
      ('chip_inventory',      ARRAY['inventory', 'jobs']),
      ('tint_inventory',      ARRAY['inventory', 'jobs']),
      ('coating_inventory',   ARRAY['inventory', 'jobs']),
      ('topcoat_inventory',   ARRAY['inventory', 'jobs']),
      ('basecoat_inventory',  ARRAY['inventory', 'jobs']),
      ('misc_inventory',      ARRAY['inventory', 'jobs']),
      ('shopping_items',      ARRAY['inventory']),
      ('referral_associates', ARRAY['referralAssociates']),
      ('referral_services',   ARRAY['referralAssociates']),
      ('ad_spend',            ARRAY['reporting'])
    ) AS t(tbl, features)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = spec.tbl
    ) THEN
      CONTINUE;
    END IF;

    -- Replace every existing policy (incl. legacy duplicates on pricing)
    FOR p IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = spec.tbl
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, spec.tbl);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', spec.tbl);

    can_write := format(
      '(org_id IS NOT NULL AND org_can_write(org_id, %L::text[]))',
      spec.features
    );

    EXECUTE format(
      'CREATE POLICY "Org-aware select" ON public.%I FOR SELECT
       USING (%s OR (org_id IS NOT NULL AND is_org_member(org_id)))',
      spec.tbl, personal);

    EXECUTE format(
      'CREATE POLICY "Org-aware insert" ON public.%I FOR INSERT TO authenticated
       WITH CHECK (user_id = auth.uid() AND (org_id IS NULL OR %s))',
      spec.tbl, can_write);

    EXECUTE format(
      'CREATE POLICY "Org-aware update" ON public.%I FOR UPDATE TO authenticated
       USING (%s OR %s)
       WITH CHECK (%s OR %s)',
      spec.tbl, personal, can_write, personal, can_write);

    EXECUTE format(
      'CREATE POLICY "Org-aware delete" ON public.%I FOR DELETE TO authenticated
       USING (%s OR (org_id IS NOT NULL AND is_org_admin(org_id)))',
      spec.tbl, personal);

    EXECUTE format('DROP TRIGGER IF EXISTS preserve_user_id_trigger ON public.%I', spec.tbl);
    EXECUTE format(
      'CREATE TRIGGER preserve_user_id_trigger BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION preserve_user_id()',
      spec.tbl);
  END LOOP;
END $$;

-- GHL webhook sources hold the secret hashes that authenticate inbound
-- leads; the app never reads them, so org rows are admin-only.
DROP POLICY IF EXISTS "Users can manage their own GHL webhook sources" ON ghl_webhook_sources;
CREATE POLICY "Users can manage their own GHL webhook sources"
  ON ghl_webhook_sources
  FOR ALL
  TO authenticated
  USING (
    (org_id IS NULL AND user_id = (SELECT auth.uid()))
    OR (org_id IS NOT NULL AND is_org_admin(org_id))
  )
  WITH CHECK (
    (org_id IS NULL AND user_id = (SELECT auth.uid()))
    OR (org_id IS NOT NULL AND is_org_admin(org_id))
  );

COMMIT;
