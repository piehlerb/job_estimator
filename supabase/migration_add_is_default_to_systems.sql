-- Migration: Add is_default field to systems table
ALTER TABLE systems
ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN systems.is_default IS 'If true, this system is pre-selected when creating a new job';
