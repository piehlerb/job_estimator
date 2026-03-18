-- Migration: Add access_level to organization_members
-- Controls which areas of the app each member can access.
-- Admins can set this per-member from the Organization page.
--
-- Values:
--   'full'           - unrestricted access to all pages (default)
--   'inventory_only' - can only view and edit the Inventory page

ALTER TABLE organization_members
ADD COLUMN IF NOT EXISTS access_level TEXT NOT NULL DEFAULT 'full'
  CHECK (access_level IN ('full', 'inventory_only'));

COMMENT ON COLUMN organization_members.access_level IS
  'Controls app access: full = all pages, inventory_only = Inventory page only';
