-- Migration: Add actual job execution fields to jobs table
-- These fields record what was actually used/done vs. estimated, for Won jobs

ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS actual_install_schedule JSONB;

ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS actual_base_coat_gallons NUMERIC;

ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS actual_top_coat_gallons NUMERIC;

ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS actual_cyclo1_gallons NUMERIC;

ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS actual_tint_oz NUMERIC;

ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS actual_chip_boxes NUMERIC;

COMMENT ON COLUMN jobs.actual_install_schedule IS 'Actual per-day schedule. Array of {day, hours, laborerIds[]}';
COMMENT ON COLUMN jobs.actual_base_coat_gallons IS 'Actual gallons of base coat used';
COMMENT ON COLUMN jobs.actual_top_coat_gallons IS 'Actual gallons of top coat used';
COMMENT ON COLUMN jobs.actual_cyclo1_gallons IS 'Actual gallons of Cyclo1 used';
COMMENT ON COLUMN jobs.actual_tint_oz IS 'Actual ounces of tint used (combined base+top)';
COMMENT ON COLUMN jobs.actual_chip_boxes IS 'Actual number of chip boxes used';
