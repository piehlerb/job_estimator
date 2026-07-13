-- Migration: Tenant-scoped ids for singleton tables
--
-- Problem: the singleton tables (costs, pricing, topcoat_inventory,
-- basecoat_inventory, misc_inventory) store one record per user/org, but
-- every client pushed it with the same primary key id = 'current'. With
-- PRIMARY KEY (id), the whole table could physically hold only ONE row —
-- a second user or org would collide with the first tenant's row: their
-- upsert either errored against RLS forever (queue stuck retrying) or,
-- for org members, was only accidentally safe because everyone shared
-- one org.
--
-- Fix: the remote id is now scoped per tenant:
--   'current:<org_id>'  for org data
--   'current:<user_id>' for personal data (org_id IS NULL)
-- Locally (IndexedDB) the id stays 'current'; the sync layer translates
-- on push and pull (see isSingletonStore/getSingletonRemoteId in
-- src/lib/syncHelpers.ts).
--
-- A CHECK (id <> 'current') constraint prevents any client from
-- recreating a bare global row. Clients older than v2.11.1 will get a
-- sync error on these five tables until they update; the queued change
-- is retained and pushed successfully after the update.
--
-- Safe to re-run (WHERE id = 'current' / DROP CONSTRAINT IF EXISTS).

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'costs', 'pricing', 'topcoat_inventory', 'basecoat_inventory',
    'misc_inventory'
  ] LOOP
    -- Rename existing bare rows to their tenant-scoped id. The
    -- sync_lww_guard trigger stamps synced_at = NOW(), so devices
    -- re-pull the renamed row and store it back under local id 'current'
    EXECUTE format(
      'UPDATE %I SET id = ''current:'' || COALESCE(org_id::text, user_id::text) WHERE id = ''current''',
      t
    );
    EXECUTE format(
      'ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I',
      t, t || '_id_not_bare_current'
    );
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I CHECK (id <> ''current'')',
      t, t || '_id_not_bare_current'
    );
  END LOOP;
END;
$$;
