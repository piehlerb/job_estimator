-- Migration: Add tint_inventory table
-- Tracks tint color inventory by color name, measured in ounces

CREATE TABLE IF NOT EXISTS tint_inventory (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  color TEXT NOT NULL,
  ounces NUMERIC(10, 2) NOT NULL DEFAULT 0,
  deleted BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ
);

-- Enable Row Level Security
ALTER TABLE tint_inventory ENABLE ROW LEVEL SECURITY;

-- Policy: users can access their own records
DROP POLICY IF EXISTS "Users can manage their own tint inventory" ON tint_inventory;
CREATE POLICY "Users can manage their own tint inventory"
  ON tint_inventory
  FOR ALL
  USING (
    (user_id = auth.uid() AND org_id IS NULL)
    OR
    (org_id IS NOT NULL AND org_id IN (
      SELECT org_id FROM organization_members WHERE user_id = auth.uid()
    ))
  )
  WITH CHECK (
    (user_id = auth.uid() AND org_id IS NULL)
    OR
    (org_id IS NOT NULL AND org_id IN (
      SELECT org_id FROM organization_members WHERE user_id = auth.uid()
    ))
  );

COMMENT ON TABLE tint_inventory IS 'Tint color inventory tracked in ounces per color';
COMMENT ON COLUMN tint_inventory.color IS 'Name of the tint color';
COMMENT ON COLUMN tint_inventory.ounces IS 'Ounces of this color on hand';
