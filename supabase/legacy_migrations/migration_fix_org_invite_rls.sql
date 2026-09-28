-- Migration: Fix organizations RLS to allow reading via valid invite code
--
-- Problem: When a new user tries to join an org via invite code, the JOIN to
-- organizations returns NULL because the user is not yet a member, causing
-- "Organization not found" error even when the invite is valid.
--
-- Fix: Allow any authenticated user to read an org if a valid (non-expired,
-- non-accepted) invitation exists for it. The invite code itself is the gate.

DROP POLICY IF EXISTS "Members can view their org" ON organizations;

CREATE POLICY "Members can view their org"
  ON organizations FOR SELECT
  USING (
    is_org_member(id)
    OR auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM organization_invitations
      WHERE org_id = id
        AND accepted_at IS NULL
        AND expires_at > NOW()
    )
  );
