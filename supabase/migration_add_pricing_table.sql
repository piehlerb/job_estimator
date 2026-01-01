-- Migration: Add pricing table and job fields for coating removal and moisture mitigation
-- This migration adds:
-- 1. New pricing table to store pricing configuration
-- 2. coating_removal and moisture_mitigation fields to jobs table
-- 3. pricing_snapshot column to jobs table for historical pricing values

-- Create pricing table
CREATE TABLE IF NOT EXISTS pricing (
  id TEXT PRIMARY KEY,
  vertical_price_per_sqft NUMERIC NOT NULL DEFAULT 12,
  anti_slip_price_per_sqft NUMERIC NOT NULL DEFAULT 0.50,
  coating_removal_paint_per_sqft NUMERIC NOT NULL DEFAULT 1.00,
  coating_removal_epoxy_per_sqft NUMERIC NOT NULL DEFAULT 2.00,
  moisture_mitigation_per_sqft NUMERIC NOT NULL DEFAULT 3.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

COMMENT ON TABLE pricing IS 'Pricing configuration for job price calculations';
COMMENT ON COLUMN pricing.vertical_price_per_sqft IS 'Price per square foot for vertical surfaces';
COMMENT ON COLUMN pricing.anti_slip_price_per_sqft IS 'Price per square foot for anti-slip additive';
COMMENT ON COLUMN pricing.coating_removal_paint_per_sqft IS 'Price per square foot for paint removal';
COMMENT ON COLUMN pricing.coating_removal_epoxy_per_sqft IS 'Price per square foot for epoxy removal';
COMMENT ON COLUMN pricing.moisture_mitigation_per_sqft IS 'Price per square foot for moisture mitigation';

-- Add RLS policies for pricing
ALTER TABLE pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own pricing"
  ON pricing FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own pricing"
  ON pricing FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pricing"
  ON pricing FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pricing"
  ON pricing FOR DELETE
  USING (auth.uid() = user_id);

-- Add new fields to jobs table
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS coating_removal TEXT DEFAULT 'None' CHECK (coating_removal IN ('None', 'Paint', 'Epoxy'));

ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS moisture_mitigation BOOLEAN DEFAULT FALSE;

ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS pricing_snapshot JSONB;

COMMENT ON COLUMN jobs.coating_removal IS 'Type of coating removal needed: None, Paint, or Epoxy';
COMMENT ON COLUMN jobs.moisture_mitigation IS 'Whether moisture mitigation is required';
COMMENT ON COLUMN jobs.pricing_snapshot IS 'Snapshot of pricing values at the time of job creation';
