-- Migration: Add tint_color field to jobs table
-- Stores the selected tint color when basecoat or topcoat tint is enabled

ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS tint_color TEXT;

COMMENT ON COLUMN jobs.tint_color IS 'Selected tint color name (when includeBasecoatTint or includeTopcoatTint is true)';
