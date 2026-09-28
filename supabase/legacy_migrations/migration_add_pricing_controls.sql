-- Migration: Add minimum margin buffer and minimum job price to pricing table
ALTER TABLE pricing ADD COLUMN IF NOT EXISTS minimum_margin_buffer NUMERIC;
ALTER TABLE pricing ADD COLUMN IF NOT EXISTS minimum_job_price NUMERIC;

COMMENT ON COLUMN pricing.minimum_margin_buffer IS 'Buffer added to total costs for suggested floor pricing (default $2000)';
COMMENT ON COLUMN pricing.minimum_job_price IS 'Minimum total suggested job price (default $2500)';
