-- Migration: Add additive cost fields
-- Adds anti-slip, abrasion resistance, and cyclo1 topcoat support

-- =====================================================
-- COSTS TABLE UPDATES
-- =====================================================

-- Add anti-slip cost per gallon to costs table
ALTER TABLE costs
ADD COLUMN IF NOT EXISTS anti_slip_cost_per_gal NUMERIC NOT NULL DEFAULT 0;

-- Add abrasion resistance cost per gallon to costs table
ALTER TABLE costs
ADD COLUMN IF NOT EXISTS abrasion_resistance_cost_per_gal NUMERIC NOT NULL DEFAULT 0;

-- Add comments
COMMENT ON COLUMN costs.anti_slip_cost_per_gal IS 'Cost per gallon for anti-slip additive';
COMMENT ON COLUMN costs.abrasion_resistance_cost_per_gal IS 'Cost per gallon for abrasion resistance additive';

-- =====================================================
-- JOBS TABLE UPDATES
-- =====================================================

-- Add anti-slip boolean to jobs table
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS anti_slip BOOLEAN DEFAULT false;

-- Add abrasion resistance boolean to jobs table
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS abrasion_resistance BOOLEAN DEFAULT false;

-- Add cyclo1 topcoat boolean to jobs table
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS cyclo1_topcoat BOOLEAN DEFAULT false;

-- Add comments
COMMENT ON COLUMN jobs.anti_slip IS 'Whether anti-slip additive is included (cost based on topcoat gallons)';
COMMENT ON COLUMN jobs.abrasion_resistance IS 'Whether abrasion resistance additive is included (cost based on cyclo1 gallons)';
COMMENT ON COLUMN jobs.cyclo1_topcoat IS 'Whether cyclo1 topcoat is included (controls cyclo1 calculation)';
