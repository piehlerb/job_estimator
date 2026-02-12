-- Migration: Add system_ids to chip_blends table
-- This allows tracking which chip systems each blend is compatible with

ALTER TABLE chip_blends
ADD COLUMN IF NOT EXISTS system_ids JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN chip_blends.system_ids IS 'Array of chip system IDs this blend is compatible with';
