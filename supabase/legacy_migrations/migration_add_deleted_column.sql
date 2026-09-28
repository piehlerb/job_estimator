-- Migration: Add soft delete support
-- Adds a 'deleted' boolean column to all tables to support soft delete functionality

-- Add deleted column to systems
ALTER TABLE systems
ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT false;

-- Add deleted column to pricing_variables
ALTER TABLE pricing_variables
ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT false;

-- Add deleted column to laborers
ALTER TABLE laborers
ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT false;

-- Add deleted column to chip_blends
ALTER TABLE chip_blends
ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT false;

-- Add deleted column to chip_inventory
ALTER TABLE chip_inventory
ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT false;

-- Add deleted column to jobs
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT false;

-- Add deleted column to costs
ALTER TABLE costs
ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT false;

-- Add deleted column to topcoat_inventory
ALTER TABLE topcoat_inventory
ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT false;

-- Add deleted column to basecoat_inventory
ALTER TABLE basecoat_inventory
ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT false;

-- Add deleted column to misc_inventory
ALTER TABLE misc_inventory
ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT false;

-- Create indexes on deleted column for better query performance
CREATE INDEX IF NOT EXISTS idx_systems_deleted ON systems(user_id, deleted) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_pricing_variables_deleted ON pricing_variables(user_id, deleted) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_laborers_deleted ON laborers(user_id, deleted) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_chip_blends_deleted ON chip_blends(user_id, deleted) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_chip_inventory_deleted ON chip_inventory(user_id, deleted) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_jobs_deleted ON jobs(user_id, deleted) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_costs_deleted ON costs(user_id, deleted) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_topcoat_inventory_deleted ON topcoat_inventory(user_id, deleted) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_basecoat_inventory_deleted ON basecoat_inventory(user_id, deleted) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_misc_inventory_deleted ON misc_inventory(user_id, deleted) WHERE deleted = false;

-- Add comments
COMMENT ON COLUMN systems.deleted IS 'Soft delete flag - when true, record is logically deleted';
COMMENT ON COLUMN pricing_variables.deleted IS 'Soft delete flag - when true, record is logically deleted';
COMMENT ON COLUMN laborers.deleted IS 'Soft delete flag - when true, record is logically deleted';
COMMENT ON COLUMN chip_blends.deleted IS 'Soft delete flag - when true, record is logically deleted';
COMMENT ON COLUMN chip_inventory.deleted IS 'Soft delete flag - when true, record is logically deleted';
COMMENT ON COLUMN jobs.deleted IS 'Soft delete flag - when true, record is logically deleted';
COMMENT ON COLUMN costs.deleted IS 'Soft delete flag - when true, record is logically deleted';
COMMENT ON COLUMN topcoat_inventory.deleted IS 'Soft delete flag - when true, record is logically deleted';
COMMENT ON COLUMN basecoat_inventory.deleted IS 'Soft delete flag - when true, record is logically deleted';
COMMENT ON COLUMN misc_inventory.deleted IS 'Soft delete flag - when true, record is logically deleted';
