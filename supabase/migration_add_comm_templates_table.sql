-- Migration: Add communication_templates table
-- Communication templates are reusable message bodies for follow-ups.
-- The [Name] placeholder is replaced with the customer's first name at render time.

CREATE TABLE IF NOT EXISTS comm_templates (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ
);

-- Enable Row Level Security
ALTER TABLE comm_templates ENABLE ROW LEVEL SECURITY;

-- Drop old recursive policy if it exists
DROP POLICY IF EXISTS "Users can manage their own comm templates" ON comm_templates;

-- Simple policy: users can only access their own records
CREATE POLICY "Users can manage their own comm templates"
  ON comm_templates
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE comm_templates IS 'Reusable communication templates for customer follow-ups';
COMMENT ON COLUMN comm_templates.body IS 'Message body; [Name] placeholder is replaced with customer first name';
