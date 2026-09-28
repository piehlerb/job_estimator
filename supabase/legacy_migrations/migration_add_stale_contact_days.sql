-- Migration: Add stale_contact_days to pricing table
ALTER TABLE pricing
ADD COLUMN IF NOT EXISTS stale_contact_days INTEGER;

COMMENT ON COLUMN pricing.stale_contact_days IS 'Days without contact before a pending job appears in the dashboard Needs Contact list (default 30)';
