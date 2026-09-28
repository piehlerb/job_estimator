-- Migration: Add reminders column to jobs

ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS reminders JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN jobs.reminders IS 'Array of reminder objects related to this job';
