-- Migration: Add base coat colors and chip blend base-coat assignments

CREATE TABLE IF NOT EXISTS base_coat_colors (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ,
  deleted BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_base_coat_colors_user_id ON base_coat_colors(user_id);
CREATE INDEX IF NOT EXISTS idx_base_coat_colors_deleted ON base_coat_colors(user_id, deleted) WHERE deleted = false;

ALTER TABLE chip_blends
ADD COLUMN IF NOT EXISTS base_coat_color_ids JSONB DEFAULT '[]'::jsonb;

COMMENT ON TABLE base_coat_colors IS 'User-managed base coat color options';
COMMENT ON COLUMN chip_blends.base_coat_color_ids IS 'Array of base coat color IDs this blend is compatible with';
