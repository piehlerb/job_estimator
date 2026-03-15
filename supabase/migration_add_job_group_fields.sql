-- Migration: Add job group fields for alternative/bundled estimates
-- Jobs in the same group share a groupId and can be presented together to a customer.
-- Alternative groups: customer chooses one option.
-- Bundled groups: multiple estimates for different areas of the same job, with aggregate totals.

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS group_id TEXT,
  ADD COLUMN IF NOT EXISTS group_type TEXT,
  ADD COLUMN IF NOT EXISTS is_primary_estimate BOOLEAN;

COMMENT ON COLUMN jobs.group_id IS 'UUID shared by all jobs in the same estimate group';
COMMENT ON COLUMN jobs.group_type IS 'Type of group: alternative or bundled';
COMMENT ON COLUMN jobs.is_primary_estimate IS 'True for the job that originated the group';
