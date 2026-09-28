-- Migration: Add 'Verbal' to jobs status check constraint
-- Drops the old constraint and recreates it with Verbal included.

ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check;

ALTER TABLE jobs
ADD CONSTRAINT jobs_status_check
CHECK (status IN ('Won', 'Lost', 'Pending', 'Verbal'));
