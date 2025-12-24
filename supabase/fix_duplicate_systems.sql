-- Fix Duplicate Chip Systems
-- This script identifies duplicate systems by name and consolidates them

-- First, let's see what duplicates we have
-- Run this SELECT first to review before making changes:

-- =====================================================
-- STEP 1: REVIEW DUPLICATES (run this first)
-- =====================================================

SELECT
    name,
    COUNT(*) as count,
    ARRAY_AGG(id ORDER BY created_at) as ids,
    ARRAY_AGG(created_at ORDER BY created_at) as created_dates
FROM systems
WHERE deleted = false OR deleted IS NULL
GROUP BY name
HAVING COUNT(*) > 1;

-- =====================================================
-- STEP 2: SEE WHICH JOBS USE WHICH SYSTEMS
-- =====================================================

-- Check which system_ids are being used by jobs
SELECT
    s.id as system_id,
    s.name as system_name,
    s.created_at,
    COUNT(j.id) as job_count
FROM systems s
LEFT JOIN jobs j ON j.system_id = s.id
WHERE s.name IN ('1/4', 'Solid Color')
GROUP BY s.id, s.name, s.created_at
ORDER BY s.name, s.created_at;

-- =====================================================
-- STEP 3: CONSOLIDATE DUPLICATES
-- For each duplicate set, keep the OLDEST (first created) system
-- and update all jobs to point to it, then soft-delete the others
-- =====================================================

-- Create a temp table with the systems to keep (oldest by created_at for each name)
WITH systems_to_keep AS (
    SELECT DISTINCT ON (name)
        id,
        name
    FROM systems
    WHERE (deleted = false OR deleted IS NULL)
    ORDER BY name, created_at ASC
),
-- Get all systems that are duplicates (not the ones we're keeping)
systems_to_remove AS (
    SELECT s.id, s.name
    FROM systems s
    WHERE s.name IN (
        SELECT name FROM systems
        WHERE deleted = false OR deleted IS NULL
        GROUP BY name HAVING COUNT(*) > 1
    )
    AND s.id NOT IN (SELECT id FROM systems_to_keep)
    AND (s.deleted = false OR s.deleted IS NULL)
)
-- Show what will be updated/deleted
SELECT
    'KEEP' as action,
    k.id,
    k.name
FROM systems_to_keep k
WHERE k.name IN ('1/4', 'Solid Color')
UNION ALL
SELECT
    'REMOVE' as action,
    r.id,
    r.name
FROM systems_to_remove r;

-- =====================================================
-- STEP 4: UPDATE JOBS (run after reviewing step 3)
-- =====================================================

-- Update jobs that reference duplicate systems to use the system we're keeping
-- This uses a CTE to find the correct "keep" system for each duplicate

WITH systems_to_keep AS (
    SELECT DISTINCT ON (name)
        id as keep_id,
        name
    FROM systems
    WHERE (deleted = false OR deleted IS NULL)
    ORDER BY name, created_at ASC
),
systems_to_remove AS (
    SELECT s.id as remove_id, s.name
    FROM systems s
    WHERE s.name IN (
        SELECT name FROM systems
        WHERE deleted = false OR deleted IS NULL
        GROUP BY name HAVING COUNT(*) > 1
    )
    AND s.id NOT IN (SELECT keep_id FROM systems_to_keep)
    AND (s.deleted = false OR s.deleted IS NULL)
)
UPDATE jobs j
SET
    system_id = k.keep_id,
    updated_at = NOW()
FROM systems_to_remove r
JOIN systems_to_keep k ON r.name = k.name
WHERE j.system_id = r.remove_id;

-- =====================================================
-- STEP 5: SOFT DELETE DUPLICATE SYSTEMS
-- =====================================================

WITH systems_to_keep AS (
    SELECT DISTINCT ON (name)
        id,
        name
    FROM systems
    WHERE (deleted = false OR deleted IS NULL)
    ORDER BY name, created_at ASC
)
UPDATE systems
SET
    deleted = true,
    updated_at = NOW()
WHERE name IN ('1/4', 'Solid Color')
AND id NOT IN (SELECT id FROM systems_to_keep)
AND (deleted = false OR deleted IS NULL);

-- =====================================================
-- STEP 6: VERIFY THE FIX
-- =====================================================

-- Check there are no more duplicates
SELECT
    name,
    COUNT(*) as count
FROM systems
WHERE deleted = false OR deleted IS NULL
GROUP BY name
HAVING COUNT(*) > 1;

-- Should return 0 rows if fixed correctly

-- Check all jobs still have valid system_ids
SELECT
    j.id as job_id,
    j.name as job_name,
    j.system_id,
    s.name as system_name
FROM jobs j
LEFT JOIN systems s ON j.system_id = s.id
WHERE s.id IS NULL OR s.deleted = true;

-- Should return 0 rows if all jobs point to valid systems
