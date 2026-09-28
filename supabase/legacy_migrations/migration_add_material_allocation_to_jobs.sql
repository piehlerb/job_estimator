-- Migration: Add material_allocation field to jobs table
-- Stores the per-job coating allocation override (topcoat flavor shares and
-- Base B component splits). Absent/null = derive defaults from base_color/tint fields.

ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS material_allocation JSONB;

COMMENT ON COLUMN jobs.material_allocation IS 'Per-job material allocation override (JobMaterialAllocation: top/base component shares); null = default allocation from baseColor/tintColor';
