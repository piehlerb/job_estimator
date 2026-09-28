-- Migration: Add products table and products column on jobs
-- Products are a catalog of wall storage and other non-coating items
-- that can be added to jobs with quantity and pricing.

-- Part A: Products catalog table
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cost NUMERIC NOT NULL DEFAULT 0,
  price NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_updated_at ON products(user_id, updated_at);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'products'
    AND policyname = 'Users can manage their own products'
  ) THEN
    CREATE POLICY "Users can manage their own products"
      ON products
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

COMMENT ON TABLE products IS 'Product catalog for wall storage and non-coating items';
COMMENT ON COLUMN products.cost IS 'Unit cost - what you pay';
COMMENT ON COLUMN products.price IS 'Standard unit price - what you charge';

-- Part B: Products JSONB column on jobs table for embedded product line items
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS products JSONB;

COMMENT ON COLUMN jobs.products IS 'Array of product line items with quantity and pricing snapshots';
