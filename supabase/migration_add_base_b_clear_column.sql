-- Migration: Add base_b_clear field to basecoat_inventory table
ALTER TABLE basecoat_inventory
ADD COLUMN IF NOT EXISTS base_b_clear NUMERIC DEFAULT 0;

COMMENT ON COLUMN basecoat_inventory.base_b_clear IS 'Gallons of Base B - Clear in inventory';
