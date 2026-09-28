-- Migration: Add install_schedule field to jobs table
-- This adds support for per-day scheduling with hours and laborers for each install day

ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS install_schedule JSONB;

COMMENT ON COLUMN jobs.install_schedule IS 'Per-day schedule with hours and laborer assignments. Array of {day: number, hours: number, laborerIds: string[]}';

-- Note: The existing job_hours field is kept for backward compatibility
-- When install_schedule is present, it takes precedence over job_hours for calculations
