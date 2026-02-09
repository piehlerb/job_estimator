-- Migration: Add target_effective_price_per_sqft field to chip_systems table
-- This field allows setting a target effective price (total job price / floor sqft)
-- for margin optimization in the pricing calculator

ALTER TABLE chip_systems
ADD COLUMN IF NOT EXISTS target_effective_price_per_sqft NUMERIC(10, 2);

COMMENT ON COLUMN chip_systems.target_effective_price_per_sqft IS 'Target effective price per sqft (total job price / floor sqft) used to optimize margin by comparing target-based vs current pricing approaches';
