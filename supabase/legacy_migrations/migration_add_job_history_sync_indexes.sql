-- Migration: Add indexes for scoped job history sync
-- Supports working-set sync, historical paging, and calendar/reporting date range loads.

CREATE INDEX IF NOT EXISTS idx_jobs_org_updated_at
  ON jobs(org_id, updated_at)
  WHERE org_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_org_install_date
  ON jobs(org_id, install_date)
  WHERE org_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_org_estimate_date
  ON jobs(org_id, estimate_date)
  WHERE org_id IS NOT NULL AND estimate_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_user_updated_at_personal
  ON jobs(user_id, updated_at)
  WHERE org_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_user_estimate_date_personal
  ON jobs(user_id, estimate_date)
  WHERE org_id IS NULL AND estimate_date IS NOT NULL;

COMMENT ON INDEX idx_jobs_org_updated_at IS 'Supports org-scoped incremental job sync pulls.';
COMMENT ON INDEX idx_jobs_org_install_date IS 'Supports org-scoped historical job paging by install date.';
COMMENT ON INDEX idx_jobs_org_estimate_date IS 'Supports org-scoped calendar/reporting loads by estimate date.';
