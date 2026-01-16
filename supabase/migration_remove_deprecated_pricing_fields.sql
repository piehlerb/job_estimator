-- Migration: Remove deprecated pricing fields that moved to chip_systems
-- These fields are now system-specific:
-- - vertical_price_per_sqft
-- - floor_price_min
-- - floor_price_max
--
-- IMPORTANT: This migration should only be run AFTER:
-- 1. migration_add_system_pricing_fields.sql has been executed
-- 2. All chip systems have been updated with their pricing values
-- 3. The application has been deployed with the fallback logic
--
-- NOTE: Keep these columns in the database for backward compatibility
-- and to support old job snapshots. The application code now uses
-- system-specific values, but falls back to these if not set.
--
-- For now, we're NOT dropping these columns. If you want to drop them
-- in the future, uncomment the following lines:
--
-- ALTER TABLE pricing DROP COLUMN IF EXISTS vertical_price_per_sqft;
-- ALTER TABLE pricing DROP COLUMN IF EXISTS floor_price_min;
-- ALTER TABLE pricing DROP COLUMN IF EXISTS floor_price_max;

-- Instead, we'll just add comments to mark them as deprecated
COMMENT ON COLUMN pricing.vertical_price_per_sqft IS 'DEPRECATED: Use chip_systems.vertical_price_per_sqft instead. Kept for backward compatibility.';
COMMENT ON COLUMN pricing.floor_price_min IS 'DEPRECATED: Use chip_systems.floor_price_min instead. Kept for backward compatibility.';
COMMENT ON COLUMN pricing.floor_price_max IS 'DEPRECATED: Use chip_systems.floor_price_max instead. Kept for backward compatibility.';
