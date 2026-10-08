-- Track chip inventory per blend + chip TYPE instead of per chip system.
--
-- A chip type is the physical chip product (1/4, 1/8, 1/16, Stone, Hybrid,
-- Stonebridge). A chip system is how it's installed, and several systems can
-- use the same chip: "1/4", "1/4 Outdoor" (double broadcast) and
-- "1/4 Chip on Wood" all draw from the same 1/4 stock. Keying inventory by
-- system (20260926153418_add_chip_inventory_system) split that stock apart.
--
-- * systems.chip_type        the chip a system uses; NULL = system uses no chip
-- * chip_inventory.chip_type the chip type a stock row is; NULL = unassigned
-- * chip_blends.chip_types   chip types a blend comes in; [] = any
--
-- chip_inventory.system_id and chip_blends.system_ids are kept but no longer
-- written; the app only reads them to resolve rows that predate chip types.
--
-- Backfill (only touches rows still missing the new columns, so it is safe to
-- re-run). updated_at is bumped so clients pull the changes on their next sync.

ALTER TABLE systems ADD COLUMN IF NOT EXISTS chip_type TEXT;
ALTER TABLE chip_inventory ADD COLUMN IF NOT EXISTS chip_type TEXT;
ALTER TABLE chip_blends ADD COLUMN IF NOT EXISTS chip_types JSONB;

COMMENT ON COLUMN systems.chip_type IS 'Physical chip this system uses (e.g. 1/4, Stone); systems sharing a chip type share inventory. NULL = no chip';
COMMENT ON COLUMN chip_inventory.chip_type IS 'Chip type this stock is (e.g. 1/4, Stone); NULL = unassigned legacy stock';
COMMENT ON COLUMN chip_inventory.system_id IS 'Legacy: chip system the stock was tagged with before chip types; superseded by chip_type';
COMMENT ON COLUMN chip_blends.chip_types IS 'Chip types this blend comes in; empty array = any';
COMMENT ON COLUMN chip_blends.system_ids IS 'Legacy: chip systems the blend was available with; superseded by chip_types';
COMMENT ON TABLE chip_inventory IS 'Chip inventory by blend and chip type';

-- 1. Systems that use chip (feet_per_lb > 0): a name starting with a chip size
--    ("1/4 Outdoor", "1/4 Chip on Wood") gets that size, otherwise the system
--    name ("Stone", "Hybrid"). Systems with no chip coverage stay NULL.
UPDATE systems
SET chip_type = COALESCE(SUBSTRING(TRIM(name) FROM '^(1/(?:4|8|16))(?:\s|$)'), TRIM(name)),
    updated_at = NOW()
WHERE chip_type IS NULL
  AND feet_per_lb > 0;

-- 2. Stock rows take the chip type of the system they were tagged with.
UPDATE chip_inventory i
SET chip_type = s.chip_type,
    updated_at = NOW()
FROM systems s
WHERE i.chip_type IS NULL
  AND i.system_id = s.id
  AND s.chip_type IS NOT NULL;

-- 3. Rows for the same blend that now share a chip type (e.g. one under "1/4"
--    and one under "1/4 Outdoor") are one physical stock: sum their pounds
--    into the largest row and soft-delete the rest.
WITH ranked AS (
  SELECT
    id,
    SUM(pounds) OVER w AS total_pounds,
    COUNT(*) OVER w AS group_size,
    ROW_NUMBER() OVER (w ORDER BY pounds DESC, id) AS rank_in_group
  FROM chip_inventory
  WHERE deleted IS NOT TRUE
    AND chip_type IS NOT NULL
  WINDOW w AS (
    PARTITION BY COALESCE(org_id::TEXT, 'user:' || user_id::TEXT), LOWER(TRIM(blend)), LOWER(TRIM(chip_type))
  )
)
UPDATE chip_inventory i
SET pounds = CASE WHEN r.rank_in_group = 1 THEN r.total_pounds ELSE i.pounds END,
    deleted = (r.rank_in_group > 1),
    updated_at = NOW()
FROM ranked r
WHERE i.id = r.id
  AND r.group_size > 1;

-- 4. Blends come in the chip types of the systems they were linked to.
UPDATE chip_blends b
SET chip_types = COALESCE((
      SELECT jsonb_agg(DISTINCT s.chip_type ORDER BY s.chip_type)
      FROM jsonb_array_elements_text(COALESCE(b.system_ids, '[]'::JSONB)) AS bs(system_id)
      JOIN systems s ON s.id = bs.system_id
      WHERE s.chip_type IS NOT NULL
    ), '[]'::JSONB),
    updated_at = NOW()
WHERE b.chip_types IS NULL;

-- Verify:
-- SELECT name, chip_type FROM systems WHERE deleted IS NOT TRUE ORDER BY name;
-- SELECT blend, chip_type, pounds FROM chip_inventory WHERE deleted IS NOT TRUE ORDER BY blend, chip_type;
-- SELECT name, chip_types FROM chip_blends WHERE deleted IS NOT TRUE ORDER BY name;
