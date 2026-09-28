-- Migration: Add slab temperature tracking to job actuals

ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS actual_slab_temp NUMERIC;

COMMENT ON COLUMN jobs.actual_slab_temp IS 'Actual slab temperature recorded for the job';
