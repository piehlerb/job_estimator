-- Migration: Add ad_spend table
-- Manually-entered advertising spend per calendar month, used by the
-- Lead Tracking report (cost per lead). One record per month per tenant.

CREATE TABLE IF NOT EXISTS ad_spend (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ
);

-- Enable Row Level Security
ALTER TABLE ad_spend ENABLE ROW LEVEL SECURITY;

-- Policy: users can access their own records
DROP POLICY IF EXISTS "Users can manage their own ad spend" ON ad_spend;
CREATE POLICY "Users can manage their own ad spend"
  ON ad_spend
  FOR ALL
  USING (
    (user_id = auth.uid() AND org_id IS NULL)
    OR
    (org_id IS NOT NULL AND org_id IN (
      SELECT org_id FROM organization_members WHERE user_id = auth.uid()
    ))
  )
  WITH CHECK (
    (user_id = auth.uid() AND org_id IS NULL)
    OR
    (org_id IS NOT NULL AND org_id IN (
      SELECT org_id FROM organization_members WHERE user_id = auth.uid()
    ))
  );

-- Server-side last-write-wins guard (same trigger as all other synced tables;
-- see migration_fix_updated_at_lww.sql)
DROP TRIGGER IF EXISTS sync_lww_guard_ad_spend ON ad_spend;
CREATE TRIGGER sync_lww_guard_ad_spend
  BEFORE INSERT OR UPDATE ON ad_spend
  FOR EACH ROW EXECUTE FUNCTION sync_lww_guard();

COMMENT ON TABLE ad_spend IS 'Manually-entered advertising spend per calendar month (lead tracking report)';
COMMENT ON COLUMN ad_spend.month IS 'Calendar month in YYYY-MM format';
COMMENT ON COLUMN ad_spend.amount IS 'Total advertising dollars spent in the month';
