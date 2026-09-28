-- Migration: Add customers table
-- This creates a dedicated customers table for managing the customer list.
-- Customers are now first-class entities instead of being derived from job data.

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ
);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);

-- Index for sync (pulling records updated since last sync)
CREATE INDEX IF NOT EXISTS idx_customers_updated_at ON customers(user_id, updated_at);

-- Row-level security
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'customers'
    AND policyname = 'Users can manage their own customers'
  ) THEN
    CREATE POLICY "Users can manage their own customers"
      ON customers
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

COMMENT ON TABLE customers IS 'Customer records managed independently from jobs';
COMMENT ON COLUMN customers.name IS 'Customer full name or company name';
COMMENT ON COLUMN customers.address IS 'Primary address for the customer';
COMMENT ON COLUMN customers.phone IS 'Contact phone number';
COMMENT ON COLUMN customers.email IS 'Contact email address';
COMMENT ON COLUMN customers.notes IS 'Additional notes about the customer';
COMMENT ON COLUMN customers.deleted IS 'Soft delete flag';
