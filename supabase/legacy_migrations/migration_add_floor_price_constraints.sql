-- Migration: Add floor price min/max constraints to pricing table
-- This migration adds configurable minimum and maximum floor price per sqft values
-- to replace hard-coded values in the suggested pricing calculation

ALTER TABLE pricing
ADD COLUMN IF NOT EXISTS floor_price_min NUMERIC DEFAULT 6.00;

ALTER TABLE pricing
ADD COLUMN IF NOT EXISTS floor_price_max NUMERIC DEFAULT 8.00;

-- Add deleted and synced_at columns for sync consistency
ALTER TABLE pricing
ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE;

ALTER TABLE pricing
ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ;

COMMENT ON COLUMN pricing.floor_price_min IS 'Minimum floor price per square foot for suggested pricing calculations';
COMMENT ON COLUMN pricing.floor_price_max IS 'Maximum floor price per square foot for suggested pricing calculations';
COMMENT ON COLUMN pricing.deleted IS 'Soft delete flag for sync';
COMMENT ON COLUMN pricing.synced_at IS 'Last sync timestamp';
