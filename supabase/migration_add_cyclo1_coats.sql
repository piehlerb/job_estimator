-- Migration: Add cyclo1_coats field to jobs table
-- This field tracks the number of cyclo1 coats (1 or 2) when cyclo1_topcoat is enabled

ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS cyclo1_coats INTEGER DEFAULT 1;

COMMENT ON COLUMN jobs.cyclo1_coats IS 'Number of cyclo1 topcoat applications (1 or 2), only used when cyclo1_topcoat is true';
