-- Migration: Add granular per-feature permissions to organization_members
-- When NULL, the app derives permissions from the legacy access_level column.
ALTER TABLE organization_members
ADD COLUMN IF NOT EXISTS permissions JSONB;

COMMENT ON COLUMN organization_members.permissions IS
  'Granular per-feature permissions (jobs, calendar, inventory, reporting, etc). NULL = derive from access_level for backwards compatibility.';
