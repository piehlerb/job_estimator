-- Migration: Add crack-fill pricing variables to pricing settings
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
      ADD COLUMN IF NOT EXISTS crack_fill_factor_units_per_gallon NUMERIC DEFAULT 5,
      ADD COLUMN IF NOT EXISTS suggested_crack_fill_price_multiplier NUMERIC DEFAULT 3;
  END IF;
END $$;

