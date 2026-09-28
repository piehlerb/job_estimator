-- Migration: prevent records from being orphaned by a NULL org_id
--
-- Background: pushes stamp org_id from the client's in-memory org context. If
-- that context was unresolved (org lookup failed, or ran before the membership
-- loaded), the push wrote org_id = NULL. Pulls filter on
-- `.eq('org_id', <current org>)`, so an org-scoped row downgraded to NULL
-- becomes invisible on every device — it exists in Supabase but never syncs
-- back down.
--
-- The client now parks sync until the org context resolves. This adds a
-- server-side backstop so a stale or buggy client can't orphan rows again.

-- 1. Guard: never let an existing org_id be overwritten with NULL.
CREATE OR REPLACE FUNCTION preserve_org_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.org_id IS NULL AND OLD.org_id IS NOT NULL THEN
    NEW.org_id := OLD.org_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION preserve_org_id() IS
  'Blocks org_id from being downgraded to NULL on update, which would hide the row from org-scoped pulls.';

-- 2. Apply to every org-scoped synced table.
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'systems', 'pricing_variables', 'costs', 'pricing', 'laborers', 'customers',
    'leads', 'lead_appointments', 'products', 'base_coat_colors', 'chip_blends',
    'chip_inventory', 'tint_inventory', 'coating_inventory', 'shopping_items',
    'comm_templates', 'referral_services', 'referral_associates', 'ad_spend',
    'topcoat_inventory', 'basecoat_inventory', 'misc_inventory', 'jobs'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'org_id'
    ) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS preserve_org_id_trigger ON %I', t);
      EXECUTE format(
        'CREATE TRIGGER preserve_org_id_trigger BEFORE UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION preserve_org_id()', t
      );
    END IF;
  END LOOP;
END $$;

-- 3. Repair existing orphans: adopt the org of the row's owner, and bump
--    updated_at/synced_at so every device's incremental pull picks them up.
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'systems', 'pricing_variables', 'laborers', 'customers',
    'leads', 'lead_appointments', 'products', 'base_coat_colors', 'chip_blends',
    'chip_inventory', 'tint_inventory', 'coating_inventory', 'shopping_items',
    'comm_templates', 'referral_services', 'referral_associates', 'ad_spend',
    'jobs'
  ];
BEGIN
  -- Singleton tables (costs, pricing, *_inventory keyed on 'current:<scope>')
  -- are deliberately excluded: a NULL-org singleton is a real personal-scope
  -- row, and adopting it could collide with the org's own singleton.
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'org_id'
    ) THEN
      EXECUTE format(
        'UPDATE %I r
            SET org_id = m.org_id,
                updated_at = NOW(),
                synced_at = NOW()
           FROM organization_members m
          WHERE r.org_id IS NULL
            AND m.user_id = r.user_id', t
      );
    END IF;
  END LOOP;
END $$;
