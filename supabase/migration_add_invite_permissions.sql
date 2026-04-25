-- Migration: Add permissions column to organization_invitations
-- Allows admins to pre-configure permissions when generating invite codes.
-- The permissions JSONB is applied to the new member on join.

ALTER TABLE organization_invitations
ADD COLUMN IF NOT EXISTS permissions JSONB;

-- Drop and recreate the RPC (return type changed — new invite_permissions column).
DROP FUNCTION IF EXISTS lookup_invite_by_code(TEXT);
CREATE OR REPLACE FUNCTION lookup_invite_by_code(p_invite_code TEXT)
RETURNS TABLE (
  invitation_id      UUID,
  org_id             UUID,
  org_name           TEXT,
  org_created_by     UUID,
  org_created_at     TIMESTAMPTZ,
  org_updated_at     TIMESTAMPTZ,
  invite_role        TEXT,
  invited_by_user    UUID,
  invite_permissions JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    i.id           AS invitation_id,
    i.org_id,
    o.name         AS org_name,
    o.created_by   AS org_created_by,
    o.created_at   AS org_created_at,
    o.updated_at   AS org_updated_at,
    i.role         AS invite_role,
    i.invited_by   AS invited_by_user,
    i.permissions  AS invite_permissions
  FROM organization_invitations i
  JOIN organizations o ON o.id = i.org_id
  WHERE i.invite_code = upper(trim(p_invite_code))
    AND i.accepted_at IS NULL
    AND i.expires_at > NOW();
END;
$$;
