-- Shipping factor: percentage added to purchased goods (materials, consumables, products).
ALTER TABLE costs
ADD COLUMN IF NOT EXISTS shipping_factor NUMERIC DEFAULT 0;

COMMENT ON COLUMN costs.shipping_factor IS 'Shipping cost as a percentage of purchased goods (5 = 5%)';
