-- Migration: Add delete_organization RPC
--
-- Allows an org admin to delete their organization.
-- Before deleting, disassociates all data records (sets org_id = NULL)
-- so members' data is preserved. ON DELETE CASCADE handles members/invitations.

CREATE OR REPLACE FUNCTION delete_organization(p_org_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify caller is admin of this org
  IF NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE org_id = p_org_id AND user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can delete the organization';
  END IF;

  -- Disassociate all data from the org so members keep their records
  UPDATE systems           SET org_id = NULL WHERE org_id = p_org_id;
  UPDATE pricing_variables SET org_id = NULL WHERE org_id = p_org_id;
  UPDATE laborers          SET org_id = NULL WHERE org_id = p_org_id;
  UPDATE chip_blends       SET org_id = NULL WHERE org_id = p_org_id;
  UPDATE base_coat_colors  SET org_id = NULL WHERE org_id = p_org_id;
  UPDATE jobs              SET org_id = NULL WHERE org_id = p_org_id;
  UPDATE chip_inventory    SET org_id = NULL WHERE org_id = p_org_id;
  UPDATE topcoat_inventory SET org_id = NULL WHERE org_id = p_org_id;
  UPDATE basecoat_inventory SET org_id = NULL WHERE org_id = p_org_id;
  UPDATE misc_inventory    SET org_id = NULL WHERE org_id = p_org_id;
  UPDATE customers         SET org_id = NULL WHERE org_id = p_org_id;
  UPDATE products          SET org_id = NULL WHERE org_id = p_org_id;
  UPDATE costs             SET org_id = NULL WHERE org_id = p_org_id;

  -- Handle pricing table if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'pricing'
  ) THEN
    EXECUTE 'UPDATE pricing SET org_id = NULL WHERE org_id = $1' USING p_org_id;
  END IF;

  -- Delete the org; ON DELETE CASCADE removes organization_members + organization_invitations
  DELETE FROM organizations WHERE id = p_org_id;
END;
$$;
