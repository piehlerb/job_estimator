-- Migration: Add evaluation JSONB column to jobs table
-- Stores floor evaluation readings: moisture, pH, hardness, CaCl (each an array of numbers)
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS evaluation JSONB;

COMMENT ON COLUMN public.jobs.evaluation IS 'Floor evaluation readings with arrays for moisture, pH, hardness, and CaCl values';
