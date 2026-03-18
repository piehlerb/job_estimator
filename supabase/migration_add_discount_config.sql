-- Migration: Add discount_config JSONB column to pricing table
-- Replaces the legacy use_suggested_discount_cap / suggested_discount_cap_sqft approach
-- with a flexible DiscountConfig object supporting per_sqft, by_tag, and none modes.

ALTER TABLE pricing
ADD COLUMN IF NOT EXISTS discount_config JSONB;

COMMENT ON COLUMN pricing.discount_config IS
  'Flexible discount configuration. mode: per_sqft | by_tag | none. '
  'per_sqft: {perSqftAmount, perSqftMaxSqft}. '
  'by_tag: {tagDiscounts: [{id, tag, amount}], tagAggregation: sum | max}.';
