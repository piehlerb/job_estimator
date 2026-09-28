-- Migration: Add notes and double_broadcast fields to systems table
-- Notes: allows storing optional notes about each chip system
-- Double Broadcast: indicates if topcoat requirements should be doubled

ALTER TABLE systems
ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE systems
ADD COLUMN IF NOT EXISTS double_broadcast BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN systems.notes IS 'Optional notes or comments about this chip system';
COMMENT ON COLUMN systems.double_broadcast IS 'If true, topcoat requirements are doubled for this system';
