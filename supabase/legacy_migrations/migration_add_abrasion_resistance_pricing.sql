-- Migration: Add abrasion_resistance_price_per_sqft field to pricing table
-- This allows pricing configuration for abrasion resistance additive

ALTER TABLE pricing
ADD COLUMN IF NOT EXISTS abrasion_resistance_price_per_sqft NUMERIC(10, 2) DEFAULT 0 NOT NULL;

COMMENT ON COLUMN pricing.abrasion_resistance_price_per_sqft IS 'Price per square foot for abrasion resistance additive';
