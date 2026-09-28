-- Migration: Add SECURITY DEFINER RPC for invite code lookup
--
-- Problem: When a non-member looks up an invite code, the JOIN to
-- organizations fails due to RLS (user is not yet a member).
-- The previous RLS fix (migration_fix_org_invite_rls.sql) may not
-- work reliably due to how PostgREST evaluates policies on joins.
--
-- Solution: Use a SECURITY DEFINER function that runs as the DB owner,
-- bypassing RLS. The function validates the invite code itself and only
-- returns data for valid, unexpired, unaccepted invitations.

CREATE OR REPLACE FUNCTION lookup_invite_by_code(p_invite_code TEXT)
RETURNS TABLE (
  invitation_id     UUID,
  org_id            UUID,
  org_name          TEXT,
  org_created_by    UUID,
  org_created_at    TIMESTAMPTZ,
  org_updated_at    TIMESTAMPTZ,
  invite_role       TEXT,
  invited_by_user   UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Only return if the caller is authenticated
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
    i.invited_by   AS invited_by_user
  FROM organization_invitations i
  JOIN organizations o ON o.id = i.org_id
  WHERE i.invite_code = upper(trim(p_invite_code))
    AND i.accepted_at IS NULL
    AND i.expires_at > NOW();
END;
$$;
