-- Migration: Add configurable vertical/travel/discount settings to pricing
-- Safe to run multiple times

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'pricing'
  ) THEN
    ALTER TABLE pricing
      ADD COLUMN IF NOT EXISTS chip_vertical_usage_factor NUMERIC DEFAULT 1.1,
      ADD COLUMN IF NOT EXISTS vertical_spread_usage_multiplier NUMERIC DEFAULT 1.25,
      ADD COLUMN IF NOT EXISTS gas_heater_months JSONB DEFAULT '[11,12,1,2,3]'::jsonb,
      ADD COLUMN IF NOT EXISTS travel_gas_mpg NUMERIC DEFAULT 10,
      ADD COLUMN IF NOT EXISTS use_suggested_discount_cap BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS suggested_discount_cap_sqft NUMERIC DEFAULT 500;
  END IF;
END $$;

