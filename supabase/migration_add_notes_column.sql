-- Migration: Add notes field to jobs table
-- Adds a 'notes' text column to the jobs table for storing additional job information

-- Add notes column to jobs
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add comment
COMMENT ON COLUMN jobs.notes IS 'Additional notes or comments about the job';
