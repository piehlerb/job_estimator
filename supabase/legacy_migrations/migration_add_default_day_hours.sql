-- Migration: Add default_day_hours to pricing table
ALTER TABLE pricing
ADD COLUMN IF NOT EXISTS default_day_hours NUMERIC DEFAULT 8;

COMMENT ON COLUMN pricing.default_day_hours IS 'Default hours per install day used when creating new job day schedules (default 8).';
