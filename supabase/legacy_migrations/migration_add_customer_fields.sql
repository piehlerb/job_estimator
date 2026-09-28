-- Migration: Add customer name and address fields to jobs table
-- Adds 'customer_name' and 'customer_address' text columns to the jobs table

-- Add customer_name column to jobs
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS customer_name TEXT;

-- Add customer_address column to jobs
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS customer_address TEXT;

-- Add comments
COMMENT ON COLUMN jobs.customer_name IS 'Customer name for the job';
COMMENT ON COLUMN jobs.customer_address IS 'Customer address for the job';
