-- Migration: Consolidate duplicate chip blends and inventory
-- Run this AFTER running the browser-side consolidation script
-- This will clean up any remaining duplicates in Supabase
--
-- IMPORTANT: Back up your data before running this script!
-- Run: SELECT * FROM chip_blends; and SELECT * FROM chip_inventory; first
-- to review the data.

-- First, let's identify duplicates (DRY RUN - just shows what would be affected)
-- Uncomment the SELECT statements to preview:

-- Preview duplicate chip blends:
-- SELECT
--     LOWER(TRIM(name)) as normalized_name,
--     COUNT(*) as count,
--     ARRAY_AGG(id) as ids,
--     ARRAY_AGG(name) as names
-- FROM chip_blends
-- WHERE deleted IS NOT TRUE
-- GROUP BY LOWER(TRIM(name))
-- HAVING COUNT(*) > 1;

-- Preview duplicate chip inventory:
-- SELECT
--     LOWER(TRIM(blend)) as normalized_blend,
--     COUNT(*) as count,
--     SUM(pounds) as total_pounds,
--     ARRAY_AGG(id) as ids,
--     ARRAY_AGG(blend || ': ' || pounds || ' lbs') as entries
-- FROM chip_inventory
-- WHERE deleted IS NOT TRUE
-- GROUP BY LOWER(TRIM(blend))
-- HAVING COUNT(*) > 1;

-- Preview jobs with non-normalized chip blend names:
-- SELECT id, name, chip_blend
-- FROM jobs
-- WHERE chip_blend IS NOT NULL
-- AND chip_blend != INITCAP(LOWER(TRIM(chip_blend)));

-- ============================================================================
-- CONSOLIDATION QUERIES (Run these after reviewing the previews above)
-- ============================================================================

-- Step 1: Create a function to title case a string
CREATE OR REPLACE FUNCTION title_case(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN INITCAP(LOWER(TRIM(COALESCE(input_text, ''))));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 2: Normalize all chip blend names (update the kept records)
-- This keeps the first record (by id) for each normalized name and normalizes its name
WITH normalized_blends AS (
    SELECT
        id,
        title_case(name) as normalized_name,
        ROW_NUMBER() OVER (PARTITION BY title_case(name) ORDER BY id) as rn
    FROM chip_blends
    WHERE deleted IS NOT TRUE
)
UPDATE chip_blends cb
SET name = nb.normalized_name,
    updated_at = NOW()
FROM normalized_blends nb
WHERE cb.id = nb.id
AND nb.rn = 1
AND cb.name != nb.normalized_name;

-- Step 3: Soft-delete duplicate chip blends (keep only the first per normalized name)
WITH duplicates AS (
    SELECT
        id,
        ROW_NUMBER() OVER (PARTITION BY title_case(name) ORDER BY id) as rn
    FROM chip_blends
    WHERE deleted IS NOT TRUE
)
UPDATE chip_blends cb
SET deleted = TRUE,
    updated_at = NOW()
FROM duplicates d
WHERE cb.id = d.id
AND d.rn > 1;

-- Step 4: Merge duplicate chip inventory (sum pounds, keep first record)
-- First, update the kept record with the sum of all duplicates
WITH inventory_sums AS (
    SELECT
        title_case(blend) as normalized_blend,
        SUM(pounds) as total_pounds
    FROM chip_inventory
    WHERE deleted IS NOT TRUE
    GROUP BY title_case(blend)
),
first_records AS (
    SELECT
        id,
        title_case(blend) as normalized_blend,
        ROW_NUMBER() OVER (PARTITION BY title_case(blend) ORDER BY id) as rn
    FROM chip_inventory
    WHERE deleted IS NOT TRUE
)
UPDATE chip_inventory ci
SET blend = fr.normalized_blend,
    pounds = is_sum.total_pounds,
    updated_at = NOW()
FROM first_records fr
JOIN inventory_sums is_sum ON fr.normalized_blend = is_sum.normalized_blend
WHERE ci.id = fr.id
AND fr.rn = 1;

-- Step 5: Soft-delete duplicate chip inventory (keep only first per normalized blend)
WITH duplicates AS (
    SELECT
        id,
        ROW_NUMBER() OVER (PARTITION BY title_case(blend) ORDER BY id) as rn
    FROM chip_inventory
    WHERE deleted IS NOT TRUE
)
UPDATE chip_inventory ci
SET deleted = TRUE,
    updated_at = NOW()
FROM duplicates d
WHERE ci.id = d.id
AND d.rn > 1;

-- Step 6: Normalize chip blend names in jobs
UPDATE jobs
SET chip_blend = title_case(chip_blend),
    updated_at = NOW()
WHERE chip_blend IS NOT NULL
AND chip_blend != title_case(chip_blend);

-- Verify results:
-- SELECT 'Chip Blends' as table_name, COUNT(*) as active_count FROM chip_blends WHERE deleted IS NOT TRUE
-- UNION ALL
-- SELECT 'Chip Inventory', COUNT(*) FROM chip_inventory WHERE deleted IS NOT TRUE;

-- List remaining chip blends:
-- SELECT id, name FROM chip_blends WHERE deleted IS NOT TRUE ORDER BY name;

-- List remaining chip inventory:
-- SELECT id, blend, pounds FROM chip_inventory WHERE deleted IS NOT TRUE ORDER BY blend;

-- Clean up the helper function if desired:
-- DROP FUNCTION IF EXISTS title_case(TEXT);
