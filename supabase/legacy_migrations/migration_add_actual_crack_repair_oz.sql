-- Migration: Add actual_crack_repair_oz column to jobs table
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS actual_crack_repair_oz NUMERIC;

COMMENT ON COLUMN jobs.actual_crack_repair_oz IS 'Actual crack repair material used in ounces';
