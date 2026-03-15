-- Migration: Add disable_gas_heater field to jobs table
-- Allows a job to zero out the gas heater cost line item.
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS disable_gas_heater BOOLEAN;

COMMENT ON COLUMN jobs.disable_gas_heater IS 'When true, the gas heater cost is set to zero for this job';
