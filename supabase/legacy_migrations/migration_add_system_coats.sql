-- Migration: Add explicit coat counts for base, top, and cyclo1 on systems
-- This replaces the old implicit topcoat doubling behavior.

ALTER TABLE systems
ADD COLUMN IF NOT EXISTS base_coats INTEGER DEFAULT 1;

ALTER TABLE systems
ADD COLUMN IF NOT EXISTS top_coats INTEGER DEFAULT 1;

ALTER TABLE systems
ADD COLUMN IF NOT EXISTS cyclo1_coats INTEGER DEFAULT 1;

UPDATE systems
SET top_coats = 2
WHERE COALESCE(double_broadcast, FALSE) = TRUE
  AND (top_coats IS NULL OR top_coats = 1);

UPDATE systems
SET base_coats = COALESCE(base_coats, 1),
    top_coats = COALESCE(top_coats, 1),
    cyclo1_coats = COALESCE(cyclo1_coats, 1);

ALTER TABLE systems
ALTER COLUMN base_coats SET NOT NULL,
ALTER COLUMN top_coats SET NOT NULL,
ALTER COLUMN cyclo1_coats SET NOT NULL;

COMMENT ON COLUMN systems.base_coats IS 'Number of base coats used for spread calculations';
COMMENT ON COLUMN systems.top_coats IS 'Number of top coats used for spread calculations';
COMMENT ON COLUMN systems.cyclo1_coats IS 'Number of cyclo1 coats used for spread calculations';
