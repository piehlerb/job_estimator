-- Per-area permission levels (none / read / write), enforced for reads too.
--
-- Until now organization_members.permissions held one boolean per area (true =
-- see and edit, false = hidden) plus 'none'/'read'/'write' for jobs and
-- 'none'/'install'/'full' for calendar, and only WRITES were checked by the
-- database: every org member could SELECT every org table, so "hidden" was
-- enforced by the app's screens only.
--
-- After this migration:
-- * Every area takes 'none' | 'read' | 'write'. Legacy values keep meaning what
--   they meant: true = write, false = none, calendar 'full' = write and
--   'install' = read. Existing members' access is unchanged.
-- * New area 'leads'. When a member's permissions predate it, leads follows the
--   higher of customers and reporting, which is what the app did before.
-- * SELECT policies check the member can read an area that needs the table.
--   Screens share data (an estimate needs costs, pricing and systems; inventory
--   commitments need jobs), so each table is readable from every area whose
--   screens load it -- see the map at the bottom.
-- * Policies are changed with ALTER POLICY (they exist since the baseline).
-- * Writes keep their existing feature lists, except leads and
--   lead_appointments, which are now written under {leads, jobs} (equivalent
--   for legacy permissions, since leads derives from customers/reporting).

-- 0 = none, 1 = read, 2 = write
CREATE OR REPLACE FUNCTION public.permission_rank(p_value jsonb)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT CASE
    WHEN p_value IN ('true'::jsonb, '"write"'::jsonb, '"full"'::jsonb) THEN 2
    WHEN p_value IN ('"read"'::jsonb, '"install"'::jsonb) THEN 1
    ELSE 0
  END;
$function$;

-- A member's level in one area, from their role, legacy access_level and
-- permissions JSON.
CREATE OR REPLACE FUNCTION public.member_area_rank(
  p_role text,
  p_access_level text,
  p_permissions jsonb,
  p_area text
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT CASE
    WHEN p_role = 'admin' THEN 2
    WHEN p_permissions IS NULL THEN
      CASE WHEN p_access_level = 'inventory_only' AND p_area <> 'inventory' THEN 0 ELSE 2 END
    WHEN p_area = 'leads' AND NOT (p_permissions ? 'leads') THEN
      GREATEST(permission_rank(p_permissions -> 'customers'), permission_rank(p_permissions -> 'reporting'))
    ELSE permission_rank(p_permissions -> p_area)
  END;
$function$;

-- Highest level the current user has in any of the given areas of an org
-- (0 when not a member).
CREATE OR REPLACE FUNCTION public.org_area_rank(p_org_id uuid, p_features text[])
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE(MAX(member_area_rank(m.role, m.access_level, m.permissions, f)), 0)
  FROM organization_members m
  CROSS JOIN unnest(p_features) AS f
  WHERE m.org_id = p_org_id
    AND m.user_id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.org_can_write(p_org_id uuid, p_features text[])
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT org_area_rank(p_org_id, p_features) >= 2;
$function$;

CREATE OR REPLACE FUNCTION public.org_can_read(p_org_id uuid, p_features text[])
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT org_area_rank(p_org_id, p_features) >= 1;
$function$;

-- Signed-in only, like org_can_write
REVOKE ALL ON FUNCTION public.org_area_rank(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_area_rank(uuid, text[]) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.org_can_read(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_can_read(uuid, text[]) TO authenticated, service_role;

-- Read map: table -> areas whose screens load it. Keep in sync with
-- STORE_READ_AREAS in src/lib/permissions.ts.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('ad_spend',            '{reporting}'),
      ('base_coat_colors',    '{jobs,chipBlends,settings}'),
      ('basecoat_inventory',  '{inventory,jobs}'),
      ('chip_blends',         '{jobs,inventory,chipBlends}'),
      ('chip_inventory',      '{inventory,jobs}'),
      ('coating_inventory',   '{inventory,jobs}'),
      ('costs',               '{jobs,inventory,reporting,costs}'),
      ('customers',           '{jobs,customers}'),
      ('jobs',                '{jobs,calendar,inventory,reporting,leads,customers}'),
      ('laborers',            '{jobs,reporting,laborers}'),
      ('lead_appointments',   '{leads,reporting}'),
      ('leads',               '{leads,reporting,jobs}'),
      ('misc_inventory',      '{inventory,jobs}'),
      ('pricing',             '{jobs,inventory,reporting,pricing,settings}'),
      ('pricing_variables',   '{jobs,pricing}'),
      ('products',            '{jobs,products}'),
      ('referral_associates', '{referralAssociates}'),
      ('referral_services',   '{referralAssociates}'),
      ('shopping_items',      '{inventory}'),
      ('systems',             '{jobs,inventory,chipSystems,chipBlends}'),
      ('tint_inventory',      '{inventory,jobs}'),
      ('topcoat_inventory',   '{inventory,jobs}')
    ) AS t(table_name, areas)
  LOOP
    EXECUTE format(
      'ALTER POLICY "Org-aware select" ON public.%I TO authenticated '
      'USING (((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_read(org_id, %L::text[])))',
      r.table_name, r.areas
    );
  END LOOP;
END $$;

-- Leads get their own area: written under {leads, jobs} (a job save updates its
-- linked lead).
ALTER POLICY "Org-aware insert" ON public.leads
  WITH CHECK (((user_id = auth.uid()) AND ((org_id IS NULL) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{leads,jobs}'::text[])))));
ALTER POLICY "Org-aware update" ON public.leads
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{leads,jobs}'::text[]))))
  WITH CHECK ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{leads,jobs}'::text[]))));

ALTER POLICY "Org-aware insert" ON public.lead_appointments
  WITH CHECK (((user_id = auth.uid()) AND ((org_id IS NULL) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{leads,jobs}'::text[])))));
ALTER POLICY "Org-aware update" ON public.lead_appointments
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{leads,jobs}'::text[]))))
  WITH CHECK ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{leads,jobs}'::text[]))));
