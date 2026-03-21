-- Migration: Add actual_vertical_price_per_sqft to jobs table
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS actual_vertical_price_per_sqft NUMERIC;

COMMENT ON COLUMN jobs.actual_vertical_price_per_sqft IS 'Actual vertical price per square foot (companion to actual_vertical_price for flexible pricing entry).';
