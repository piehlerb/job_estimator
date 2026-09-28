-- Migration: Add tags field to jobs table
-- Adds a tags array column so jobs can be filtered/grouped in reporting

ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS tags TEXT[];

COMMENT ON COLUMN jobs.tags IS 'Optional list of tags for reporting and filtering';

-- Optional performance index for tag-based filters
CREATE INDEX IF NOT EXISTS idx_jobs_tags_gin ON jobs USING GIN (tags);
