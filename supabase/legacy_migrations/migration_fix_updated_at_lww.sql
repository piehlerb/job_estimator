-- Migration: Fix cross-device sync (last-write-wins) for all synced tables
--
-- Problem 1: update_updated_at_column() unconditionally stamped
-- NEW.updated_at = NOW() on every UPDATE. Sync pushes are upserts, so the
-- client's edit-time updated_at was replaced with the server's push time.
-- Conflict resolution ("last write wins" on updated_at) then compared edit
-- times against PUSH times, meaning whichever device pushed last won —
-- silently reverting newer edits from other devices (costs, jobs, systems,
-- laborers, inventories, leads, ...).
--
-- Problem 2: some synced tables (customers, products, tint_inventory,
-- coating_inventory, shopping_items, comm_templates, referral_*, pricing,
-- base_coat_colors) had NO trigger, so a stale push could blindly overwrite
-- a newer server row.
--
-- Fix: a single sync_lww_guard() trigger on every synced table that
--   1. preserves a client-supplied updated_at (the edit time),
--   2. rejects (skips) UPDATEs carrying an OLDER updated_at than the
--      existing row — server-side last-write-wins,
--   3. stamps synced_at = NOW() (server arrival time) on every accepted
--      write. Incremental pulls filter on synced_at, so records edited
--      offline and pushed late are still pulled by other devices, and
--      server-side writers (e.g. the ghl-webhook edge function) propagate
--      without having to set synced_at themselves.
--
-- update_updated_at_column() is restored to its original behavior for the
-- remaining non-synced tables (organizations, ghl_webhook_*,
-- user_preferences).
--
-- NOTE for manual edits via the Supabase dashboard/SQL editor on synced
-- tables: set updated_at = NOW() in your UPDATE so devices treat the edit
-- as newest; synced_at is stamped automatically.
--
-- Safe to re-run (CREATE OR REPLACE / DROP IF EXISTS).

-- Restore original behavior for non-synced tables
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Last-write-wins guard + arrival stamp for synced tables
CREATE OR REPLACE FUNCTION sync_lww_guard()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.updated_at IS NULL THEN
    -- Writer didn't supply an edit timestamp (e.g. direct server-side edit)
    NEW.updated_at = NOW();
  ELSIF TG_OP = 'UPDATE' AND OLD.updated_at IS NOT NULL
        AND NEW.updated_at < OLD.updated_at THEN
    -- Stale sync push: an older edit must not overwrite a newer one.
    -- Skip this row's update; the pushing device receives the newer
    -- values on its next pull.
    RETURN NULL;
  END IF;
  -- Server arrival time — incremental pulls filter on this column
  NEW.synced_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Swap triggers on all synced tables
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'systems', 'pricing_variables', 'costs', 'pricing', 'laborers',
    'customers', 'leads', 'lead_appointments', 'products',
    'base_coat_colors', 'chip_blends', 'chip_inventory', 'tint_inventory',
    'coating_inventory', 'shopping_items', 'comm_templates',
    'referral_services', 'referral_associates', 'topcoat_inventory',
    'basecoat_inventory', 'misc_inventory', 'jobs'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS update_%I_updated_at ON %I', t, t);
    EXECUTE format('DROP TRIGGER IF EXISTS sync_lww_guard_%I ON %I', t, t);
    EXECUTE format(
      'CREATE TRIGGER sync_lww_guard_%I BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION sync_lww_guard()',
      t, t
    );
    -- Backfill rows that predate synced_at stamping (e.g. webhook-created
    -- leads); the new trigger stamps them with NOW() so they get pulled
    EXECUTE format('UPDATE %I SET synced_at = NOW() WHERE synced_at IS NULL', t);
  END LOOP;
END;
$$;
