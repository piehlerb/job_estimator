-- Migration: Add moisture mitigation inventory and actual material tracking

ALTER TABLE misc_inventory
ADD COLUMN IF NOT EXISTS moisture_mitigation NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS actual_moisture_mitigation_gallons NUMERIC;

COMMENT ON COLUMN misc_inventory.moisture_mitigation IS 'Gallons of moisture mitigation product on hand';
COMMENT ON COLUMN jobs.actual_moisture_mitigation_gallons IS 'Actual gallons of moisture mitigation product used';
