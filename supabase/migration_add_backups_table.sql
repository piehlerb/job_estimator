-- Migration: Add backups table for cloud backup/restore functionality
-- Each backup stores a full JSON snapshot of all user data.
-- Max 30 backups per user (older ones are pruned client-side).

CREATE TABLE IF NOT EXISTS backups (
  id           TEXT        PRIMARY KEY,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id       UUID        REFERENCES organizations(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data         JSONB       NOT NULL,
  record_count INTEGER     NOT NULL DEFAULT 0,
  note         TEXT
);

CREATE INDEX IF NOT EXISTS idx_backups_user_id    ON backups(user_id);
CREATE INDEX IF NOT EXISTS idx_backups_org_id     ON backups(org_id);
CREATE INDEX IF NOT EXISTS idx_backups_created_at ON backups(created_at DESC);

ALTER TABLE backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own backups" ON backups
  FOR ALL USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.org_id = backups.org_id
        AND organization_members.user_id = auth.uid()
    )
  );
