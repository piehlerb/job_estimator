-- Migration: Add moisture mitigation cost fields to costs table
ALTER TABLE costs
ADD COLUMN IF NOT EXISTS moisture_mitigation_cost_per_gal NUMERIC DEFAULT 0;

ALTER TABLE costs
ADD COLUMN IF NOT EXISTS moisture_mitigation_spread_rate NUMERIC DEFAULT 200;

COMMENT ON COLUMN costs.moisture_mitigation_cost_per_gal IS 'Cost per gallon of moisture mitigation product';
COMMENT ON COLUMN costs.moisture_mitigation_spread_rate IS 'Square feet of floor covered per gallon of moisture mitigation product';
