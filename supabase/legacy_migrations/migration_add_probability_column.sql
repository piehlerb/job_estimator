-- Migration: Add probability field to jobs table
-- Stores the likelihood of closing: 0, 20, 40, 60, 80, or 100 (percent)

ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS probability SMALLINT;

COMMENT ON COLUMN jobs.probability IS 'Probability of closing: 0, 20, 40, 60, 80, or 100 (percent)';
