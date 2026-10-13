-- Audit log of every change to org data, plus an "agent" flag on members.
--
-- * audit_log: one row per applied insert / update / delete on the org data
--   tables and on organization membership and invitations. Written by an AFTER
--   trigger, so it records what actually landed (a stale sync push that
--   sync_lww_guard skips never reaches it) and covers every client: the app,
--   the GHL webhook (actor NULL = system) and anything else.
--   `changes` holds { column: { old, new } } for the columns that changed;
--   inserts carry only `new`, deletes only `old`. Bookkeeping columns
--   (updated_at, synced_at, synced, created_at) are left out, and an update
--   that changes nothing else is not logged. Setting `deleted` true/false is
--   logged as 'delete' / 'restore', matching the app's soft deletes.
--   Rows are read-only: org admins can read their org's log; nobody can write
--   or edit it except the trigger.
-- * organization_members.is_agent / organization_invitations.is_agent: marks
--   an AI agent's account. accept_invite copies it from the invitation, and the
--   audit log stamps it on each entry so agent activity can be filtered.

ALTER TABLE public.organization_members ADD COLUMN IF NOT EXISTS is_agent boolean NOT NULL DEFAULT false;
ALTER TABLE public.organization_invitations ADD COLUMN IF NOT EXISTS is_agent boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.organization_members.is_agent IS 'True when this member is an AI agent account';
COMMENT ON COLUMN public.organization_invitations.is_agent IS 'Invitation is for an AI agent; copied to organization_members.is_agent on accept';

CREATE TABLE IF NOT EXISTS public.audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id uuid,
  user_id uuid,
  actor_email text,
  is_agent boolean NOT NULL DEFAULT false,
  table_name text NOT NULL,
  record_id text,
  record_label text,
  action text NOT NULL CHECK (action IN ('insert', 'update', 'delete', 'restore')),
  changes jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.audit_log IS 'Who changed what: one row per applied change to org data (written by audit_row_change)';
COMMENT ON COLUMN public.audit_log.user_id IS 'Acting user (auth.uid()); NULL = system, e.g. the GHL webhook';
COMMENT ON COLUMN public.audit_log.changes IS '{ column: { old, new } } for changed columns; inserts carry new only, deletes old only';

CREATE INDEX IF NOT EXISTS idx_audit_log_org_created ON public.audit_log (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_org_user_created ON public.audit_log (org_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_record ON public.audit_log (table_name, record_id);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view org audit log" ON public.audit_log;
CREATE POLICY "Admins can view org audit log" ON public.audit_log AS PERMISSIVE FOR SELECT TO authenticated
  USING (((org_id IS NOT NULL) AND is_org_admin(org_id)) OR ((org_id IS NULL) AND (user_id = auth.uid())));
REVOKE ALL ON public.audit_log FROM anon, authenticated;
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_old jsonb := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END;
  v_new jsonb := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END;
  v_row jsonb;
  v_ignore text[] := ARRAY['updated_at', 'synced_at', 'synced', 'created_at'];
  v_changes jsonb;
  v_action text;
  v_org uuid;
  v_uid uuid := auth.uid();
  v_email text;
  v_agent boolean := false;
BEGIN
  v_row := COALESCE(v_new, v_old);
  v_org := NULLIF(v_row ->> 'org_id', '')::uuid;

  IF TG_OP = 'INSERT' THEN
    v_action := 'insert';
    SELECT jsonb_object_agg(key, jsonb_build_object('new', value)) INTO v_changes
    FROM jsonb_each(v_new)
    WHERE NOT key = ANY (v_ignore) AND value <> 'null'::jsonb;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    SELECT jsonb_object_agg(key, jsonb_build_object('old', value)) INTO v_changes
    FROM jsonb_each(v_old)
    WHERE NOT key = ANY (v_ignore) AND value <> 'null'::jsonb;
  ELSE
    SELECT jsonb_object_agg(n.key, jsonb_build_object('old', o.value, 'new', n.value)) INTO v_changes
    FROM jsonb_each(v_new) AS n
    LEFT JOIN jsonb_each(v_old) AS o ON o.key = n.key
    WHERE NOT n.key = ANY (v_ignore)
      AND o.value IS DISTINCT FROM n.value;
    IF v_changes IS NULL THEN
      RETURN NULL; -- only bookkeeping columns changed
    END IF;
    v_action := CASE
      WHEN COALESCE((v_old ->> 'deleted')::boolean, false) = false
           AND COALESCE((v_new ->> 'deleted')::boolean, false) = true THEN 'delete'
      WHEN COALESCE((v_old ->> 'deleted')::boolean, false) = true
           AND COALESCE((v_new ->> 'deleted')::boolean, false) = false THEN 'restore'
      ELSE 'update'
    END;
  END IF;

  IF v_uid IS NOT NULL THEN
    IF v_org IS NOT NULL THEN
      SELECT m.email, m.is_agent INTO v_email, v_agent
      FROM organization_members m
      WHERE m.org_id = v_org AND m.user_id = v_uid;
    END IF;
    IF v_email IS NULL OR v_email = '' THEN
      SELECT u.email INTO v_email FROM auth.users u WHERE u.id = v_uid;
    END IF;
  END IF;

  INSERT INTO audit_log (org_id, user_id, actor_email, is_agent, table_name, record_id, record_label, action, changes)
  VALUES (
    v_org,
    v_uid,
    v_email,
    COALESCE(v_agent, false),
    TG_TABLE_NAME,
    v_row ->> 'id',
    COALESCE(
      v_row ->> 'name', v_row ->> 'customer_name', v_row ->> 'email', v_row ->> 'blend',
      v_row ->> 'color', v_row ->> 'month', v_row ->> 'calendar_name'
    ),
    v_action,
    v_changes
  );
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- Never block a user's save because the audit write failed
  RAISE WARNING 'audit_row_change failed on %: %', TG_TABLE_NAME, SQLERRM;
  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.audit_row_change() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ad_spend', 'base_coat_colors', 'basecoat_inventory', 'chip_blends', 'chip_inventory',
    'coating_inventory', 'costs', 'customers', 'jobs', 'laborers', 'lead_appointments', 'leads',
    'misc_inventory', 'pricing', 'pricing_variables', 'products', 'referral_associates',
    'referral_services', 'shopping_items', 'systems', 'tint_inventory', 'topcoat_inventory',
    'organization_members', 'organization_invitations'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_row_change ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER audit_row_change AFTER INSERT OR UPDATE OR DELETE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION audit_row_change()',
      t
    );
  END LOOP;
END $$;

-- accept_invite: unchanged except it copies is_agent onto the new member
CREATE OR REPLACE FUNCTION public.accept_invite(p_invite_code text)
 RETURNS organizations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid    UUID := auth.uid();
  v_email  TEXT;
  v_invite organization_invitations;
  v_org    organizations;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

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

  INSERT INTO organization_members (org_id, user_id, email, role, invited_by, permissions, is_agent)
  VALUES (
    v_invite.org_id, v_uid, COALESCE(v_email, ''),
    v_invite.role, v_invite.invited_by, v_invite.permissions, v_invite.is_agent
  );

  UPDATE organization_invitations
  SET accepted_by = v_uid, accepted_at = NOW()
  WHERE id = v_invite.id;

  SELECT * INTO v_org FROM organizations WHERE id = v_invite.org_id;
  RETURN v_org;
END;
$function$;
