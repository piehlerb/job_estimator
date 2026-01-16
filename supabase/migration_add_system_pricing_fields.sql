-- Migration: Add pricing fields to chip_systems table
-- These fields move from the pricing table to be system-specific

ALTER TABLE chip_systems
ADD COLUMN IF NOT EXISTS vertical_price_per_sqft NUMERIC(10, 2) DEFAULT 0.75;

ALTER TABLE chip_systems
ADD COLUMN IF NOT EXISTS floor_price_min NUMERIC(10, 2) DEFAULT 6.00;

ALTER TABLE chip_systems
ADD COLUMN IF NOT EXISTS floor_price_max NUMERIC(10, 2) DEFAULT 8.00;

COMMENT ON COLUMN chip_systems.vertical_price_per_sqft IS 'Price per square foot for vertical surfaces (system-specific)';
COMMENT ON COLUMN chip_systems.floor_price_min IS 'Minimum suggested floor price per square foot for this system';
COMMENT ON COLUMN chip_systems.floor_price_max IS 'Maximum suggested floor price per square foot for this system';
