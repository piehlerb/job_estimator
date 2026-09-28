-- Migration: Add estimate_date and decision_date fields to jobs table
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS estimate_date DATE;

ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS decision_date DATE;

COMMENT ON COLUMN jobs.estimate_date IS 'Date the estimate was created/sent (defaults to created_at date)';
COMMENT ON COLUMN jobs.decision_date IS 'Date the customer made a decision (Won/Lost)';
