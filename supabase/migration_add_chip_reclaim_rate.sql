-- Migration: Add chip_reclaim_rate to pricing table
ALTER TABLE pricing
ADD COLUMN IF NOT EXISTS chip_reclaim_rate NUMERIC DEFAULT 0;

COMMENT ON COLUMN pricing.chip_reclaim_rate IS 'Percentage of chip reclaimed after each job (0-100). Used in Job Summary inventory planning.';
