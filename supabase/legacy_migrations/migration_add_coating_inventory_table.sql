-- Migration: Add coating_inventory table
-- Tracks coating inventory at the SKU level (part + variant + color), measured in gallons.
-- Replaces the fixed-field topcoat_inventory/basecoat_inventory singletons (kept for back-compat).

CREATE TABLE IF NOT EXISTS coating_inventory (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  part TEXT NOT NULL,
  variant TEXT,
  color TEXT,
  gallons NUMERIC(10, 2) NOT NULL DEFAULT 0,
  sort_order INTEGER,
  deleted BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ
);

-- Enable Row Level Security
ALTER TABLE coating_inventory ENABLE ROW LEVEL SECURITY;

-- Policy: users can access their own records
DROP POLICY IF EXISTS "Users can manage their own coating inventory" ON coating_inventory;
CREATE POLICY "Users can manage their own coating inventory"
  ON coating_inventory
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

COMMENT ON TABLE coating_inventory IS 'SKU-level coating inventory (part + variant + color), tracked in gallons';
COMMENT ON COLUMN coating_inventory.part IS 'Coating part: topA | topB | baseA | baseB';
COMMENT ON COLUMN coating_inventory.variant IS 'Flavor: Original/Slow Cure for top parts, Normal/Extended for baseB; NULL for baseA';
COMMENT ON COLUMN coating_inventory.color IS 'Base B color only: Grey | Tan | Clear';
COMMENT ON COLUMN coating_inventory.gallons IS 'Gallons of this SKU on hand';
COMMENT ON COLUMN coating_inventory.sort_order IS 'Display order for grouping SKUs in tables';
