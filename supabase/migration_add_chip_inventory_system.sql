-- Migration: Track chip inventory per blend AND chip system
--
-- A blend such as "Blue" can come in several chip systems (1/4, 1/8, ...), and each
-- is a different physical product. chip_inventory rows now carry the system they
-- belong to. Rows with a NULL system_id are treated by the app as "unassigned"
-- legacy stock that the user can assign on the Inventory page.
--
-- Backfill rule for existing rows:
--   * blend configured for exactly one system  -> that system
--   * blend configured for several (or no) systems -> the "1/4" system
--
-- Run in the Supabase SQL editor. Safe to re-run: only rows with a NULL system_id
-- are touched. updated_at is bumped so clients pull the change on their next sync.

ALTER TABLE chip_inventory
ADD COLUMN IF NOT EXISTS system_id TEXT;

COMMENT ON COLUMN chip_inventory.system_id IS 'Chip system this stock belongs to; NULL = unassigned legacy stock';

WITH scoped AS (
  -- Every live inventory row still missing a system, with the distinct live
  -- systems its blend is configured for (within the same org, or same user when
  -- the row is not org-scoped).
  SELECT
    i.id,
    ARRAY_AGG(DISTINCT s.id) FILTER (WHERE s.id IS NOT NULL) AS blend_system_ids
  FROM chip_inventory i
  LEFT JOIN chip_blends b
    ON LOWER(TRIM(b.name)) = LOWER(TRIM(i.blend))
   AND b.deleted IS NOT TRUE
   AND ((i.org_id IS NOT NULL AND b.org_id = i.org_id)
     OR (i.org_id IS NULL AND b.org_id IS NULL AND b.user_id = i.user_id))
  LEFT JOIN LATERAL jsonb_array_elements_text(COALESCE(b.system_ids, '[]'::jsonb)) AS bs(system_id) ON TRUE
  LEFT JOIN systems s
    ON s.id = bs.system_id
   AND s.deleted IS NOT TRUE
   AND ((i.org_id IS NOT NULL AND s.org_id = i.org_id)
     OR (i.org_id IS NULL AND s.org_id IS NULL AND s.user_id = i.user_id))
  WHERE i.system_id IS NULL
    AND i.deleted IS NOT TRUE
  GROUP BY i.id
),
resolved AS (
  SELECT
    sc.id,
    CASE
      WHEN COALESCE(ARRAY_LENGTH(sc.blend_system_ids, 1), 0) = 1 THEN sc.blend_system_ids[1]
      ELSE (
        SELECT q.id
        FROM systems q
        WHERE TRIM(q.name) = '1/4'
          AND q.deleted IS NOT TRUE
          AND ((i.org_id IS NOT NULL AND q.org_id = i.org_id)
            OR (i.org_id IS NULL AND q.org_id IS NULL AND q.user_id = i.user_id))
        ORDER BY q.created_at
        LIMIT 1
      )
    END AS system_id
  FROM scoped sc
  JOIN chip_inventory i ON i.id = sc.id
)
UPDATE chip_inventory i
SET system_id = r.system_id,
    updated_at = NOW()
FROM resolved r
WHERE i.id = r.id
  AND r.system_id IS NOT NULL;

-- Verify:
-- SELECT i.blend, s.name AS system, i.pounds
-- FROM chip_inventory i LEFT JOIN systems s ON s.id = i.system_id
-- WHERE i.deleted IS NOT TRUE
-- ORDER BY i.blend, s.name;
