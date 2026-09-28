-- Migration: Allow NULL values for optional fields
-- Run this in Supabase SQL Editor to fix NOT NULL constraints

-- Systems table - make numeric fields nullable
ALTER TABLE systems ALTER COLUMN cyclo1_spread DROP NOT NULL;
ALTER TABLE systems ALTER COLUMN base_spread DROP NOT NULL;
ALTER TABLE systems ALTER COLUMN top_spread DROP NOT NULL;

-- Costs table - make numeric fields nullable
ALTER TABLE costs ALTER COLUMN cyclo1_cost_per_gal DROP NOT NULL;

-- Comment
COMMENT ON COLUMN systems.cyclo1_spread IS 'Optional: Can be NULL if not applicable';
