-- Migration: Seed customers table from existing job data
--
-- Groups jobs by (user_id, lower(customer_name)), picks the most recent
-- non-blank address per customer, and inserts one customer record per group.
-- Uses ON CONFLICT DO NOTHING so it is safe to re-run.
--
-- Run AFTER migration_add_customers_table.sql

WITH

-- Step 1: Rank every job row within its (user_id, name_key) group by recency
ranked AS (
  SELECT
    user_id,
    lower(trim(customer_name))                         AS name_key,
    customer_name,
    customer_address,
    created_at,
    updated_at,
    -- Most-recently-updated row wins for the canonical name
    ROW_NUMBER() OVER (
      PARTITION BY user_id, lower(trim(customer_name))
      ORDER BY updated_at DESC NULLS LAST
    ) AS name_rank,
    -- Most-recently-updated row that has a non-blank address wins for address
    ROW_NUMBER() OVER (
      PARTITION BY user_id, lower(trim(customer_name))
      ORDER BY
        CASE WHEN customer_address IS NOT NULL AND trim(customer_address) <> '' THEN 0 ELSE 1 END,
        updated_at DESC NULLS LAST
    ) AS address_rank
  FROM jobs
  WHERE
    customer_name IS NOT NULL
    AND trim(customer_name) <> ''
    AND deleted = false
),

-- Step 2: Pull the canonical name (rank 1 by recency)
best_name AS (
  SELECT user_id, name_key, customer_name AS name
  FROM ranked
  WHERE name_rank = 1
),

-- Step 3: Pull the best address (rank 1 by has-address + recency)
best_address AS (
  SELECT user_id, name_key,
    CASE WHEN customer_address IS NOT NULL AND trim(customer_address) <> ''
         THEN customer_address
         ELSE NULL
    END AS address
  FROM ranked
  WHERE address_rank = 1
),

-- Step 4: Aggregate timestamps across all jobs per (user_id, name_key)
agg AS (
  SELECT
    user_id,
    lower(trim(customer_name)) AS name_key,
    MIN(created_at)            AS created_at,
    MAX(updated_at)            AS updated_at
  FROM jobs
  WHERE
    customer_name IS NOT NULL
    AND trim(customer_name) <> ''
    AND deleted = false
  GROUP BY user_id, lower(trim(customer_name))
)

INSERT INTO customers (id, user_id, name, address, deleted, created_at, updated_at)
SELECT
  md5(agg.user_id::text || '::' || agg.name_key) AS id,
  agg.user_id,
  best_name.name,
  best_address.address,
  false,
  agg.created_at,
  agg.updated_at
FROM agg
JOIN best_name    ON best_name.user_id    = agg.user_id AND best_name.name_key    = agg.name_key
JOIN best_address ON best_address.user_id = agg.user_id AND best_address.name_key = agg.name_key

ON CONFLICT (id) DO NOTHING;
