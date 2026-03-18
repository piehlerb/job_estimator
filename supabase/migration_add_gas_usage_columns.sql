-- Migration: Add gas generator and gas heater gallons-per-hour columns to pricing table
-- These were present in the app's Pricing type but never added to the database.

ALTER TABLE pricing
ADD COLUMN IF NOT EXISTS gas_generator_gallons_per_hour NUMERIC DEFAULT 1.2;

ALTER TABLE pricing
ADD COLUMN IF NOT EXISTS gas_heater_gallons_per_hour NUMERIC DEFAULT 1;

COMMENT ON COLUMN pricing.gas_generator_gallons_per_hour IS 'Fuel consumption rate for the gas generator (gallons per hour, default 1.2)';
COMMENT ON COLUMN pricing.gas_heater_gallons_per_hour IS 'Fuel consumption rate for the gas heater (gallons per hour, default 1)';
