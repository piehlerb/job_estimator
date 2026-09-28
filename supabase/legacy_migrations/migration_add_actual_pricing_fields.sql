-- Migration: Add actual pricing fields to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS actual_discount NUMERIC;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS actual_crack_price NUMERIC;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS actual_floor_price_per_sqft NUMERIC;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS actual_floor_price NUMERIC;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS actual_vertical_price NUMERIC;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS actual_anti_slip_price NUMERIC;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS actual_abrasion_resistance_price NUMERIC;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS actual_coating_removal_price NUMERIC;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS actual_moisture_mitigation_price NUMERIC;
