-- Migration: structured address fields on jobs, leads and customers
--
-- Purely additive. Adds nullable columns and NOT VALID check constraints; reads,
-- modifies and drops nothing. Nothing in the app reads these columns until the
-- address parser ships, so applying this cannot break the running PWA.
--
-- The existing free-text columns (jobs.customer_address, leads.address,
-- customers.address) are deliberately KEPT. They remain the record of what was
-- actually typed or received. The structured columns are a derived projection:
-- when a parse turns out wrong, the original is still there to re-derive from.
--
-- Naming follows each table's existing convention: jobs already prefixes contact
-- details with customer_ (customer_name, customer_address); leads and customers
-- do not.
--
-- street2 exists because unit / apt / suite is the single most common thing that
-- breaks a four-field address model. Cheap to add now, painful later. Nothing
-- populates it yet.
--
-- address_parse_tier records HOW a value was derived:
--   A  = anchored on a known ZIP, or supplied as discrete fields by GHL
--   A! = ZIP contradicts the typed town, in a different county -> needs a human
--   B  = city + state matched, ZIP derived from a single-ZIP town
--   C  = city matched without a state, unique across reference data
--   D  = nothing resolvable
--   M  = entered or corrected by hand
--   NULL = not yet parsed
--
-- address_verified_at is set when a human confirms the row. Any row with a
-- non-null address_verified_at is off-limits to automated passes and to webhook
-- overwrites (see supabase/functions/ghl-webhook/index.ts mergeLeadRow). Without
-- this ratchet, a later pass silently reverts hand corrections.
--
-- Safe to re-run.

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS customer_street      TEXT,
  ADD COLUMN IF NOT EXISTS customer_street2     TEXT,
  ADD COLUMN IF NOT EXISTS customer_city        TEXT,
  ADD COLUMN IF NOT EXISTS customer_state       TEXT,
  ADD COLUMN IF NOT EXISTS customer_zip         TEXT,
  ADD COLUMN IF NOT EXISTS address_parse_tier   TEXT,
  ADD COLUMN IF NOT EXISTS address_verified_at  TIMESTAMPTZ;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS street               TEXT,
  ADD COLUMN IF NOT EXISTS street2              TEXT,
  ADD COLUMN IF NOT EXISTS city                 TEXT,
  ADD COLUMN IF NOT EXISTS state                TEXT,
  ADD COLUMN IF NOT EXISTS zip                  TEXT,
  ADD COLUMN IF NOT EXISTS address_parse_tier   TEXT,
  ADD COLUMN IF NOT EXISTS address_verified_at  TIMESTAMPTZ;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS street               TEXT,
  ADD COLUMN IF NOT EXISTS street2              TEXT,
  ADD COLUMN IF NOT EXISTS city                 TEXT,
  ADD COLUMN IF NOT EXISTS state                TEXT,
  ADD COLUMN IF NOT EXISTS zip                  TEXT,
  ADD COLUMN IF NOT EXISTS address_parse_tier   TEXT,
  ADD COLUMN IF NOT EXISTS address_verified_at  TIMESTAMPTZ;

COMMENT ON COLUMN public.jobs.customer_street IS 'Job-site street line, derived from customer_address or entered by hand';
COMMENT ON COLUMN public.jobs.address_parse_tier IS 'How the structured address was derived: A, A!, B, C, D, or M (hand-entered)';
COMMENT ON COLUMN public.jobs.address_verified_at IS 'Human sign-off; rows carrying this are never touched by automated passes';
COMMENT ON COLUMN public.leads.street IS 'Street line, from GHL address1 or derived from the raw address';
COMMENT ON COLUMN public.leads.address_verified_at IS 'Human sign-off; blocks webhook and automated overwrites of every address column';
COMMENT ON COLUMN public.customers.street IS 'Primary/billing street line, derived from address or entered by hand';

-- Format constraints, not foreign keys. A FK to a ZIP reference table would
-- reject any out-of-scope ZIP (there are MA, SC, GA, RI and CA addresses in the
-- data today) and would make reference data load-bearing for writes.
--
-- NOT VALID means existing rows are not checked on apply, so the statement takes
-- no meaningful lock. New and updated rows ARE checked immediately.
--
-- IMPORTANT: sync pushes are BATCHED upserts (src/lib/sync.ts), so a single
-- violation fails the entire batch and breaks sync for that whole table. Every
-- writer must emit a two-letter uppercase state and a five-digit ZIP, or NULL.
-- Run the VALIDATE statements at the bottom only after the backfill reports
-- clean.
--
-- Wrapped in DO blocks because ADD CONSTRAINT has no IF NOT EXISTS.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_customer_state_format' AND conrelid = 'public.jobs'::regclass) THEN
    ALTER TABLE public.jobs ADD CONSTRAINT jobs_customer_state_format
      CHECK (customer_state IS NULL OR customer_state ~ '^[A-Z]{2}$') NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_customer_zip_format' AND conrelid = 'public.jobs'::regclass) THEN
    ALTER TABLE public.jobs ADD CONSTRAINT jobs_customer_zip_format
      CHECK (customer_zip IS NULL OR customer_zip ~ '^[0-9]{5}$') NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_state_format' AND conrelid = 'public.leads'::regclass) THEN
    ALTER TABLE public.leads ADD CONSTRAINT leads_state_format
      CHECK (state IS NULL OR state ~ '^[A-Z]{2}$') NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_zip_format' AND conrelid = 'public.leads'::regclass) THEN
    ALTER TABLE public.leads ADD CONSTRAINT leads_zip_format
      CHECK (zip IS NULL OR zip ~ '^[0-9]{5}$') NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_state_format' AND conrelid = 'public.customers'::regclass) THEN
    ALTER TABLE public.customers ADD CONSTRAINT customers_state_format
      CHECK (state IS NULL OR state ~ '^[A-Z]{2}$') NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_zip_format' AND conrelid = 'public.customers'::regclass) THEN
    ALTER TABLE public.customers ADD CONSTRAINT customers_zip_format
      CHECK (zip IS NULL OR zip ~ '^[0-9]{5}$') NOT VALID;
  END IF;
END;
$$;

-- Run only after the backfill reports clean:
--
--   ALTER TABLE public.jobs      VALIDATE CONSTRAINT jobs_customer_state_format;
--   ALTER TABLE public.jobs      VALIDATE CONSTRAINT jobs_customer_zip_format;
--   ALTER TABLE public.leads     VALIDATE CONSTRAINT leads_state_format;
--   ALTER TABLE public.leads     VALIDATE CONSTRAINT leads_zip_format;
--   ALTER TABLE public.customers VALIDATE CONSTRAINT customers_state_format;
--   ALTER TABLE public.customers VALIDATE CONSTRAINT customers_zip_format;
