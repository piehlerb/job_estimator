-- Baseline: the live public schema as of 2026-09-28, generated from the
-- production catalog. Replaces the unordered supabase/migration_*.sql files
-- (archived in supabase/legacy_migrations/). Column comments are not included.
SET check_function_bodies = false;

CREATE OR REPLACE FUNCTION public.delete_organization(p_org_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Verify caller is admin of this org
  IF NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE org_id = p_org_id AND user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can delete the organization';
  END IF;

  -- Disassociate all data from the org so members keep their records
  UPDATE systems           SET org_id = NULL WHERE org_id = p_org_id;
  UPDATE pricing_variables SET org_id = NULL WHERE org_id = p_org_id;
  UPDATE laborers          SET org_id = NULL WHERE org_id = p_org_id;
  UPDATE chip_blends       SET org_id = NULL WHERE org_id = p_org_id;
  UPDATE base_coat_colors  SET org_id = NULL WHERE org_id = p_org_id;
  UPDATE jobs              SET org_id = NULL WHERE org_id = p_org_id;
  UPDATE chip_inventory    SET org_id = NULL WHERE org_id = p_org_id;
  UPDATE topcoat_inventory SET org_id = NULL WHERE org_id = p_org_id;
  UPDATE basecoat_inventory SET org_id = NULL WHERE org_id = p_org_id;
  UPDATE misc_inventory    SET org_id = NULL WHERE org_id = p_org_id;
  UPDATE customers         SET org_id = NULL WHERE org_id = p_org_id;
  UPDATE products          SET org_id = NULL WHERE org_id = p_org_id;
  UPDATE costs             SET org_id = NULL WHERE org_id = p_org_id;

  -- Handle pricing table if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'pricing'
  ) THEN
    EXECUTE 'UPDATE pricing SET org_id = NULL WHERE org_id = $1' USING p_org_id;
  END IF;

  -- Delete the org; ON DELETE CASCADE removes organization_members + organization_invitations
  DELETE FROM organizations WHERE id = p_org_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_invite_code()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_org_admin(p_org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE org_id = p_org_id AND user_id = auth.uid() AND role = 'admin'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE org_id = p_org_id AND user_id = auth.uid()
  );
$function$
;

CREATE OR REPLACE FUNCTION public.lookup_invite_by_code(p_invite_code text)
 RETURNS TABLE(invitation_id uuid, org_id uuid, org_name text, org_created_by uuid, org_created_at timestamp with time zone, org_updated_at timestamp with time zone, invite_role text, invited_by_user uuid, invite_permissions jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    i.id           AS invitation_id,
    i.org_id,
    o.name         AS org_name,
    o.created_by   AS org_created_by,
    o.created_at   AS org_created_at,
    o.updated_at   AS org_updated_at,
    i.role         AS invite_role,
    i.invited_by   AS invited_by_user,
    i.permissions  AS invite_permissions
  FROM organization_invitations i
  JOIN organizations o ON o.id = i.org_id
  WHERE i.invite_code = upper(trim(p_invite_code))
    AND i.accepted_at IS NULL
    AND i.expires_at > NOW();
END;
$function$
;

CREATE OR REPLACE FUNCTION public.migrate_user_data_to_org(p_org_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Verify caller is a member of this org
  IF NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE org_id = p_org_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  -- Non-singleton tables: migrate all personal records
  UPDATE systems          SET org_id = p_org_id WHERE user_id = auth.uid() AND org_id IS NULL;
  UPDATE pricing_variables SET org_id = p_org_id WHERE user_id = auth.uid() AND org_id IS NULL;
  UPDATE laborers         SET org_id = p_org_id WHERE user_id = auth.uid() AND org_id IS NULL;
  UPDATE chip_blends      SET org_id = p_org_id WHERE user_id = auth.uid() AND org_id IS NULL;
  UPDATE base_coat_colors SET org_id = p_org_id WHERE user_id = auth.uid() AND org_id IS NULL;
  UPDATE jobs             SET org_id = p_org_id WHERE user_id = auth.uid() AND org_id IS NULL;
  UPDATE chip_inventory   SET org_id = p_org_id WHERE user_id = auth.uid() AND org_id IS NULL;
  UPDATE customers        SET org_id = p_org_id WHERE user_id = auth.uid() AND org_id IS NULL;
  UPDATE products         SET org_id = p_org_id WHERE user_id = auth.uid() AND org_id IS NULL;

  -- Singleton tables: only migrate if org doesn't already have one
  UPDATE costs SET org_id = p_org_id
    WHERE user_id = auth.uid()
      AND org_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM costs WHERE org_id = p_org_id);

  UPDATE topcoat_inventory SET org_id = p_org_id
    WHERE user_id = auth.uid()
      AND org_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM topcoat_inventory WHERE org_id = p_org_id);

  UPDATE basecoat_inventory SET org_id = p_org_id
    WHERE user_id = auth.uid()
      AND org_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM basecoat_inventory WHERE org_id = p_org_id);

  UPDATE misc_inventory SET org_id = p_org_id
    WHERE user_id = auth.uid()
      AND org_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM misc_inventory WHERE org_id = p_org_id);

  -- Handle pricing table if it exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pricing') THEN
    EXECUTE '
      UPDATE pricing SET org_id = $1
        WHERE user_id = auth.uid()
          AND org_id IS NULL
          AND NOT EXISTS (SELECT 1 FROM pricing WHERE org_id = $1)'
    USING p_org_id;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.org_can_write(p_org_id uuid, p_features text[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM organization_members m
    WHERE m.org_id = p_org_id
      AND m.user_id = auth.uid()
      AND (
        m.role = 'admin'
        OR (m.permissions IS NULL AND m.access_level <> 'inventory_only')
        OR (m.permissions IS NULL AND m.access_level = 'inventory_only'
            AND 'inventory' = ANY (p_features))
        OR (m.permissions IS NOT NULL AND EXISTS (
              SELECT 1 FROM unnest(p_features) AS f
              WHERE (f = 'jobs' AND m.permissions ->> 'jobs' = 'write')
                 OR (f <> 'jobs' AND m.permissions -> f = 'true'::jsonb)
            ))
      )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.preserve_org_id()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.org_id IS NULL AND OLD.org_id IS NOT NULL THEN
    NEW.org_id := OLD.org_id;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.preserve_user_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    NEW.user_id := OLD.user_id;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_lww_guard()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.updated_at IS NULL THEN
    NEW.updated_at = NOW();
  ELSIF TG_OP = 'UPDATE' AND OLD.updated_at IS NOT NULL
        AND NEW.updated_at < OLD.updated_at THEN
    -- Stale sync push: skip; pusher receives newer values on next pull
    RETURN NULL;
  END IF;
  -- Server arrival time; incremental pulls filter on this column
  NEW.synced_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.title_case(input_text text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
BEGIN
    RETURN INITCAP(LOWER(TRIM(COALESCE(input_text, ''))));
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE TABLE public.ad_spend (
  id text NOT NULL,
  user_id uuid,
  org_id uuid,
  month text NOT NULL,
  amount numeric(12,2) DEFAULT 0 NOT NULL,
  notes text,
  deleted boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  synced_at timestamp with time zone,
  CONSTRAINT ad_spend_pkey PRIMARY KEY (id)
);

CREATE TABLE public.base_coat_colors (
  id text NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  synced_at timestamp with time zone,
  deleted boolean DEFAULT false NOT NULL,
  org_id uuid,
  CONSTRAINT base_coat_colors_pkey PRIMARY KEY (id)
);

CREATE TABLE public.basecoat_inventory (
  id text NOT NULL,
  user_id uuid NOT NULL,
  base_a numeric NOT NULL,
  base_b_grey numeric NOT NULL,
  base_b_tan numeric NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  synced_at timestamp with time zone,
  deleted boolean DEFAULT false NOT NULL,
  base_b_clear numeric DEFAULT 0,
  org_id uuid,
  CONSTRAINT basecoat_inventory_pkey PRIMARY KEY (id),
  CONSTRAINT basecoat_inventory_id_not_bare_current CHECK ((id <> 'current'::text))
);

CREATE TABLE public.chip_blends (
  id text NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  synced_at timestamp with time zone,
  deleted boolean DEFAULT false NOT NULL,
  system_ids jsonb DEFAULT '[]'::jsonb,
  base_coat_color_ids jsonb DEFAULT '[]'::jsonb,
  org_id uuid,
  CONSTRAINT chip_blends_pkey PRIMARY KEY (id)
);

CREATE TABLE public.chip_inventory (
  id text NOT NULL,
  user_id uuid NOT NULL,
  blend text NOT NULL,
  pounds numeric NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  synced_at timestamp with time zone,
  deleted boolean DEFAULT false NOT NULL,
  org_id uuid,
  system_id text,
  CONSTRAINT chip_inventory_pkey PRIMARY KEY (id)
);

CREATE TABLE public.coating_inventory (
  id text NOT NULL,
  user_id uuid,
  org_id uuid,
  part text NOT NULL,
  variant text,
  color text,
  gallons numeric(10,2) DEFAULT 0 NOT NULL,
  sort_order integer,
  deleted boolean DEFAULT false NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  synced_at timestamp with time zone,
  CONSTRAINT coating_inventory_pkey PRIMARY KEY (id)
);

CREATE TABLE public.comm_templates (
  id text NOT NULL,
  user_id uuid,
  org_id uuid,
  name text NOT NULL,
  body text NOT NULL,
  deleted boolean DEFAULT false,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  synced_at timestamp with time zone,
  CONSTRAINT comm_templates_pkey PRIMARY KEY (id)
);

CREATE TABLE public.costs (
  id text NOT NULL,
  user_id uuid NOT NULL,
  base_cost_per_gal numeric NOT NULL,
  top_cost_per_gal numeric NOT NULL,
  crack_fill_cost numeric NOT NULL,
  gas_cost numeric NOT NULL,
  consumables_cost numeric NOT NULL,
  cyclo1_cost_per_gal numeric,
  tint_cost_per_quart numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  synced_at timestamp with time zone,
  deleted boolean DEFAULT false NOT NULL,
  anti_slip_cost_per_gal numeric DEFAULT 0 NOT NULL,
  abrasion_resistance_cost_per_gal numeric DEFAULT 0 NOT NULL,
  moisture_mitigation_cost_per_gal numeric DEFAULT 0,
  moisture_mitigation_spread_rate numeric DEFAULT 200,
  org_id uuid,
  CONSTRAINT costs_pkey PRIMARY KEY (id),
  CONSTRAINT costs_id_not_bare_current CHECK ((id <> 'current'::text))
);

CREATE TABLE public.customers (
  id text NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  address text,
  phone text,
  email text,
  notes text,
  deleted boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  synced_at timestamp with time zone,
  org_id uuid,
  street text,
  street2 text,
  city text,
  state text,
  zip text,
  address_parse_tier text,
  address_verified_at timestamp with time zone,
  CONSTRAINT customers_pkey PRIMARY KEY (id)
);

CREATE TABLE public.ghl_webhook_events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  org_id uuid,
  webhook_source_id uuid NOT NULL,
  event_type text NOT NULL,
  dedupe_key text NOT NULL,
  received_at timestamp with time zone DEFAULT now() NOT NULL,
  processed_at timestamp with time zone,
  processing_status text DEFAULT 'pending'::text NOT NULL,
  error_message text,
  raw_payload jsonb NOT NULL,
  source_workflow text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT ghl_webhook_events_pkey PRIMARY KEY (id),
  CONSTRAINT ghl_webhook_events_event_type_check CHECK ((event_type = ANY (ARRAY['lead.created'::text, 'appointment.booked'::text, 'appointment.rescheduled'::text, 'appointment.canceled'::text, 'appointment.completed'::text]))),
  CONSTRAINT ghl_webhook_events_processing_status_check CHECK ((processing_status = ANY (ARRAY['pending'::text, 'processed'::text, 'failed'::text, 'needs_review'::text, 'ignored'::text])))
);

CREATE TABLE public.ghl_webhook_sources (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  org_id uuid,
  name text NOT NULL,
  secret_hash text NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT ghl_webhook_sources_pkey PRIMARY KEY (id)
);

CREATE TABLE public.jobs (
  id text NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  system_id text NOT NULL,
  floor_footage numeric NOT NULL,
  vertical_footage numeric NOT NULL,
  crack_fill_factor numeric NOT NULL,
  travel_distance numeric NOT NULL,
  install_date text NOT NULL,
  install_days integer NOT NULL,
  job_hours numeric NOT NULL,
  total_price numeric NOT NULL,
  chip_blend text,
  base_color text,
  status text NOT NULL,
  include_basecoat_tint boolean,
  include_topcoat_tint boolean,
  google_drive_folder_id text,
  costs_snapshot jsonb NOT NULL,
  system_snapshot jsonb NOT NULL,
  laborers_snapshot jsonb NOT NULL,
  photos jsonb,
  synced boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  synced_at timestamp with time zone,
  deleted boolean DEFAULT false NOT NULL,
  notes text,
  anti_slip boolean DEFAULT false,
  abrasion_resistance boolean DEFAULT false,
  cyclo1_topcoat boolean DEFAULT false,
  cyclo1_coats integer DEFAULT 1,
  install_schedule jsonb,
  coating_removal text DEFAULT 'None'::text,
  moisture_mitigation boolean DEFAULT false,
  pricing_snapshot jsonb,
  customer_name text,
  customer_address text,
  actual_discount numeric,
  actual_crack_price numeric,
  actual_floor_price_per_sqft numeric,
  actual_floor_price numeric,
  actual_vertical_price numeric,
  actual_anti_slip_price numeric,
  actual_abrasion_resistance_price numeric,
  actual_coating_removal_price numeric,
  actual_moisture_mitigation_price numeric,
  tags text[],
  estimate_date date,
  decision_date date,
  products jsonb,
  reminders jsonb DEFAULT '[]'::jsonb,
  group_id text,
  group_type text,
  is_primary_estimate boolean,
  disable_gas_heater boolean,
  actual_install_schedule jsonb,
  actual_base_coat_gallons numeric,
  actual_top_coat_gallons numeric,
  actual_cyclo1_gallons numeric,
  actual_tint_oz numeric,
  actual_chip_boxes numeric,
  probability smallint,
  org_id uuid,
  tint_color text,
  actual_vertical_price_per_sqft numeric,
  actual_crack_repair_oz numeric,
  follow_ups jsonb,
  evaluation jsonb,
  actual_expense_adjustment numeric,
  actual_expense_adjustment_notes text,
  inventory_actuals_applied jsonb,
  lead_id text,
  actual_moisture_mitigation_gallons numeric,
  actual_slab_temp numeric,
  material_allocation jsonb,
  customer_street text,
  customer_street2 text,
  customer_city text,
  customer_state text,
  customer_zip text,
  address_parse_tier text,
  address_verified_at timestamp with time zone,
  CONSTRAINT jobs_pkey PRIMARY KEY (id),
  CONSTRAINT jobs_coating_removal_check CHECK ((coating_removal = ANY (ARRAY['None'::text, 'Paint'::text, 'Epoxy'::text]))),
  CONSTRAINT jobs_status_check CHECK ((status = ANY (ARRAY['Won'::text, 'Lost'::text, 'Pending'::text, 'Verbal'::text])))
);

CREATE TABLE public.laborers (
  id text NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  fully_loaded_rate numeric NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  synced_at timestamp with time zone,
  deleted boolean DEFAULT false NOT NULL,
  org_id uuid,
  CONSTRAINT laborers_pkey PRIMARY KEY (id)
);

CREATE TABLE public.lead_appointments (
  id text NOT NULL,
  user_id uuid,
  org_id uuid,
  lead_id text NOT NULL,
  ghl_appointment_id text,
  scheduled_start_at timestamp with time zone,
  scheduled_end_at timestamp with time zone,
  status text DEFAULT 'booked'::text NOT NULL,
  calendar_name text,
  assigned_user text,
  created_from_event_id uuid,
  last_event_id uuid,
  deleted boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  synced_at timestamp with time zone,
  CONSTRAINT lead_appointments_pkey PRIMARY KEY (id),
  CONSTRAINT lead_appointments_status_check CHECK ((status = ANY (ARRAY['booked'::text, 'rescheduled'::text, 'canceled'::text, 'no_show'::text, 'completed'::text])))
);

CREATE TABLE public.leads (
  id text NOT NULL,
  user_id uuid,
  org_id uuid,
  ghl_contact_id text,
  name text,
  phone text,
  email text,
  address text,
  source text,
  campaign text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
  last_event_at timestamp with time zone,
  stage text DEFAULT 'New'::text NOT NULL,
  disposition_reason text,
  disposition_notes text,
  closed_at timestamp with time zone,
  customer_id text,
  deleted boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  synced_at timestamp with time zone,
  street text,
  street2 text,
  city text,
  state text,
  zip text,
  address_parse_tier text,
  address_verified_at timestamp with time zone,
  CONSTRAINT leads_pkey PRIMARY KEY (id),
  CONSTRAINT leads_disposition_reason_check CHECK (((disposition_reason IS NULL) OR (disposition_reason = ANY (ARRAY['Not Interested'::text, 'Out of Territory'::text, 'Wrong Service'::text, 'Bad Contact Info'::text, 'Duplicate'::text, 'Spam'::text, 'Unresponsive'::text, 'Price/Budget'::text, 'Timing'::text, 'Other'::text])))),
  CONSTRAINT leads_stage_check CHECK ((stage = ANY (ARRAY['New'::text, 'Contact Attempted'::text, 'Engaged'::text, 'Estimate Booked'::text, 'Estimate Completed'::text, 'Quoted'::text, 'Won'::text, 'Lost'::text, 'Disqualified'::text])))
);

CREATE TABLE public.misc_inventory (
  id text NOT NULL,
  user_id uuid NOT NULL,
  crack_repair numeric NOT NULL,
  silica_sand numeric NOT NULL,
  shot numeric NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  synced_at timestamp with time zone,
  deleted boolean DEFAULT false NOT NULL,
  org_id uuid,
  moisture_mitigation numeric DEFAULT 0 NOT NULL,
  CONSTRAINT misc_inventory_pkey PRIMARY KEY (id),
  CONSTRAINT misc_inventory_id_not_bare_current CHECK ((id <> 'current'::text))
);

CREATE TABLE public.organization_invitations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  org_id uuid NOT NULL,
  email text,
  role text DEFAULT 'member'::text NOT NULL,
  invite_code text DEFAULT generate_invite_code() NOT NULL,
  invited_by uuid NOT NULL,
  accepted_by uuid,
  accepted_at timestamp with time zone,
  expires_at timestamp with time zone DEFAULT (now() + '30 days'::interval) NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  permissions jsonb,
  CONSTRAINT organization_invitations_invite_code_key UNIQUE (invite_code),
  CONSTRAINT organization_invitations_pkey PRIMARY KEY (id),
  CONSTRAINT organization_invitations_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'member'::text])))
);

CREATE TABLE public.organization_members (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  org_id uuid NOT NULL,
  user_id uuid NOT NULL,
  email text NOT NULL,
  role text DEFAULT 'member'::text NOT NULL,
  invited_by uuid,
  joined_at timestamp with time zone DEFAULT now() NOT NULL,
  access_level text DEFAULT 'full'::text NOT NULL,
  permissions jsonb,
  CONSTRAINT organization_members_org_id_user_id_key UNIQUE (org_id, user_id),
  CONSTRAINT organization_members_pkey PRIMARY KEY (id),
  CONSTRAINT organization_members_access_level_check CHECK ((access_level = ANY (ARRAY['full'::text, 'inventory_only'::text]))),
  CONSTRAINT organization_members_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'member'::text])))
);

CREATE TABLE public.organizations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT organizations_pkey PRIMARY KEY (id)
);

CREATE TABLE public.pricing (
  id text NOT NULL,
  vertical_price_per_sqft numeric DEFAULT 12 NOT NULL,
  anti_slip_price_per_sqft numeric DEFAULT 0.50 NOT NULL,
  coating_removal_paint_per_sqft numeric DEFAULT 1.00 NOT NULL,
  coating_removal_epoxy_per_sqft numeric DEFAULT 2.00 NOT NULL,
  moisture_mitigation_per_sqft numeric DEFAULT 3.00 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  user_id uuid NOT NULL,
  floor_price_min numeric DEFAULT 6.00,
  floor_price_max numeric DEFAULT 8.00,
  deleted boolean DEFAULT false,
  synced_at timestamp with time zone,
  abrasion_resistance_price_per_sqft numeric(10,2) DEFAULT 0 NOT NULL,
  minimum_margin_buffer numeric,
  minimum_job_price numeric,
  crack_fill_factor_units_per_gallon numeric DEFAULT 5,
  suggested_crack_fill_price_multiplier numeric DEFAULT 3,
  chip_vertical_usage_factor numeric DEFAULT 1.1,
  vertical_spread_usage_multiplier numeric DEFAULT 1.25,
  gas_heater_months jsonb DEFAULT '[11, 12, 1, 2, 3]'::jsonb,
  travel_gas_mpg numeric DEFAULT 10,
  use_suggested_discount_cap boolean DEFAULT true,
  suggested_discount_cap_sqft numeric DEFAULT 500,
  org_id uuid,
  discount_config jsonb,
  gas_generator_gallons_per_hour numeric DEFAULT 1.2,
  gas_heater_gallons_per_hour numeric DEFAULT 1,
  chip_reclaim_rate numeric DEFAULT 0,
  default_day_hours numeric DEFAULT 8,
  stale_contact_days integer,
  default_reminder_days integer,
  default_reminder_time text,
  auto_reminder_rules jsonb,
  CONSTRAINT pricing_pkey PRIMARY KEY (id),
  CONSTRAINT pricing_id_not_bare_current CHECK ((id <> 'current'::text))
);

CREATE TABLE public.pricing_variables (
  id text NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  value numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  synced_at timestamp with time zone,
  deleted boolean DEFAULT false NOT NULL,
  org_id uuid,
  chip_reclaim_rate numeric DEFAULT 0,
  default_day_hours numeric DEFAULT 8,
  CONSTRAINT pricing_variables_pkey PRIMARY KEY (id)
);

CREATE TABLE public.products (
  id text NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  cost numeric DEFAULT 0 NOT NULL,
  price numeric DEFAULT 0 NOT NULL,
  description text,
  deleted boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  synced_at timestamp with time zone,
  org_id uuid,
  CONSTRAINT products_pkey PRIMARY KEY (id)
);

CREATE TABLE public.referral_associates (
  id text NOT NULL,
  user_id uuid,
  org_id uuid,
  name text NOT NULL,
  company text,
  address text,
  phone text,
  email text,
  notes text,
  service_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
  deleted boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  synced_at timestamp with time zone,
  CONSTRAINT referral_associates_pkey PRIMARY KEY (id)
);

CREATE TABLE public.referral_services (
  id text NOT NULL,
  user_id uuid,
  org_id uuid,
  name text NOT NULL,
  deleted boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  synced_at timestamp with time zone,
  CONSTRAINT referral_services_pkey PRIMARY KEY (id)
);

CREATE TABLE public.route_planner_settings (
  id text NOT NULL,
  user_id uuid NOT NULL,
  home_base_address text,
  home_base_lat double precision,
  home_base_lng double precision,
  default_duration_minutes integer DEFAULT 60,
  lookahead_days integer DEFAULT 7,
  buffer_minutes integer DEFAULT 15,
  work_start_hour text DEFAULT '08:00'::text,
  work_end_hour text DEFAULT '17:30'::text,
  google_client_id text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted boolean DEFAULT false,
  org_id uuid,
  synced_at timestamp with time zone,
  CONSTRAINT route_planner_settings_pkey PRIMARY KEY (id)
);

CREATE TABLE public.shopping_items (
  id text NOT NULL,
  user_id uuid NOT NULL,
  org_id uuid,
  name text NOT NULL,
  completed boolean DEFAULT false NOT NULL,
  deleted boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  synced_at timestamp with time zone,
  CONSTRAINT shopping_items_pkey PRIMARY KEY (id)
);

CREATE TABLE public.sync_log (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  sync_type text NOT NULL,
  started_at timestamp with time zone DEFAULT now() NOT NULL,
  completed_at timestamp with time zone,
  records_pulled integer DEFAULT 0,
  records_pushed integer DEFAULT 0,
  errors jsonb,
  success boolean,
  CONSTRAINT sync_log_pkey PRIMARY KEY (id),
  CONSTRAINT sync_log_sync_type_check CHECK ((sync_type = ANY (ARRAY['full'::text, 'incremental'::text, 'manual'::text])))
);

CREATE TABLE public.sync_queue (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  operation_type text NOT NULL,
  table_name text NOT NULL,
  record_id text NOT NULL,
  record_data jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  retry_count integer DEFAULT 0 NOT NULL,
  last_error text,
  processed_at timestamp with time zone,
  CONSTRAINT sync_queue_pkey PRIMARY KEY (id),
  CONSTRAINT sync_queue_operation_type_check CHECK ((operation_type = ANY (ARRAY['create'::text, 'update'::text, 'delete'::text])))
);

CREATE TABLE public.systems (
  id text NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  feet_per_lb numeric NOT NULL,
  box_cost numeric NOT NULL,
  base_spread numeric,
  top_spread numeric,
  cyclo1_spread numeric,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  synced_at timestamp with time zone,
  deleted boolean DEFAULT false NOT NULL,
  vertical_price_per_sqft numeric(10,2) DEFAULT 0.75,
  floor_price_min numeric(10,2) DEFAULT 6.00,
  floor_price_max numeric(10,2) DEFAULT 8.00,
  target_effective_price_per_sqft numeric(10,2),
  notes text,
  double_broadcast boolean DEFAULT false,
  base_coats integer DEFAULT 1 NOT NULL,
  top_coats integer DEFAULT 1 NOT NULL,
  cyclo1_coats integer DEFAULT 1 NOT NULL,
  is_default boolean DEFAULT false,
  org_id uuid,
  CONSTRAINT systems_pkey PRIMARY KEY (id)
);

CREATE TABLE public.tint_inventory (
  id text NOT NULL,
  user_id uuid,
  org_id uuid,
  color text NOT NULL,
  ounces numeric(10,2) DEFAULT 0 NOT NULL,
  deleted boolean DEFAULT false NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  synced_at timestamp with time zone,
  CONSTRAINT tint_inventory_pkey PRIMARY KEY (id)
);

CREATE TABLE public.topcoat_inventory (
  id text NOT NULL,
  user_id uuid NOT NULL,
  top_a numeric NOT NULL,
  top_b numeric NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  synced_at timestamp with time zone,
  deleted boolean DEFAULT false NOT NULL,
  org_id uuid,
  CONSTRAINT topcoat_inventory_pkey PRIMARY KEY (id),
  CONSTRAINT topcoat_inventory_id_not_bare_current CHECK ((id <> 'current'::text))
);

CREATE TABLE public.user_preferences (
  user_id uuid NOT NULL,
  auto_sync_enabled boolean DEFAULT true NOT NULL,
  sync_interval_minutes integer DEFAULT 5 NOT NULL,
  theme text DEFAULT 'light'::text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT user_preferences_pkey PRIMARY KEY (user_id)
);

-- Address format checks were added NOT VALID (existing rows not re-checked)
ALTER TABLE public.customers ADD CONSTRAINT customers_state_format CHECK (((state IS NULL) OR (state ~ '^[A-Z]{2}$'::text))) NOT VALID;
ALTER TABLE public.customers ADD CONSTRAINT customers_zip_format CHECK (((zip IS NULL) OR (zip ~ '^[0-9]{5}$'::text))) NOT VALID;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_customer_state_format CHECK (((customer_state IS NULL) OR (customer_state ~ '^[A-Z]{2}$'::text))) NOT VALID;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_customer_zip_format CHECK (((customer_zip IS NULL) OR (customer_zip ~ '^[0-9]{5}$'::text))) NOT VALID;
ALTER TABLE public.leads ADD CONSTRAINT leads_state_format CHECK (((state IS NULL) OR (state ~ '^[A-Z]{2}$'::text))) NOT VALID;
ALTER TABLE public.leads ADD CONSTRAINT leads_zip_format CHECK (((zip IS NULL) OR (zip ~ '^[0-9]{5}$'::text))) NOT VALID;

CREATE OR REPLACE FUNCTION public.accept_invite(p_invite_code text)
 RETURNS organizations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid    UUID := auth.uid();
  v_email  TEXT;
  v_invite organization_invitations;
  v_org    organizations;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_invite
  FROM organization_invitations
  WHERE invite_code = upper(btrim(p_invite_code))
    AND accepted_at IS NULL
    AND expires_at > NOW()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invite code.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM organization_members
    WHERE org_id = v_invite.org_id AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'You are already a member of this organization.';
  END IF;

  IF EXISTS (SELECT 1 FROM organization_members WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'Leave your current organization before joining another.';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  INSERT INTO organization_members (org_id, user_id, email, role, invited_by, permissions)
  VALUES (
    v_invite.org_id, v_uid, COALESCE(v_email, ''),
    v_invite.role, v_invite.invited_by, v_invite.permissions
  );

  UPDATE organization_invitations
  SET accepted_by = v_uid, accepted_at = NOW()
  WHERE id = v_invite.id;

  SELECT * INTO v_org FROM organizations WHERE id = v_invite.org_id;
  RETURN v_org;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_organization(p_name text)
 RETURNS organizations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid   UUID := auth.uid();
  v_email TEXT;
  v_org   organizations;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'Organization name is required.';
  END IF;

  IF EXISTS (SELECT 1 FROM organization_members WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'You already belong to an organization.';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  INSERT INTO organizations (name, created_by)
  VALUES (btrim(p_name), v_uid)
  RETURNING * INTO v_org;

  INSERT INTO organization_members (org_id, user_id, email, role)
  VALUES (v_org.id, v_uid, COALESCE(v_email, ''), 'admin');

  RETURN v_org;
END;
$function$
;

ALTER TABLE public.ad_spend ADD CONSTRAINT ad_spend_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.ad_spend ADD CONSTRAINT ad_spend_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.base_coat_colors ADD CONSTRAINT base_coat_colors_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
ALTER TABLE public.base_coat_colors ADD CONSTRAINT base_coat_colors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.basecoat_inventory ADD CONSTRAINT basecoat_inventory_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
ALTER TABLE public.basecoat_inventory ADD CONSTRAINT basecoat_inventory_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.chip_blends ADD CONSTRAINT chip_blends_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
ALTER TABLE public.chip_blends ADD CONSTRAINT chip_blends_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.chip_inventory ADD CONSTRAINT chip_inventory_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
ALTER TABLE public.chip_inventory ADD CONSTRAINT chip_inventory_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.coating_inventory ADD CONSTRAINT coating_inventory_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.coating_inventory ADD CONSTRAINT coating_inventory_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.comm_templates ADD CONSTRAINT comm_templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.costs ADD CONSTRAINT costs_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
ALTER TABLE public.costs ADD CONSTRAINT costs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.customers ADD CONSTRAINT customers_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
ALTER TABLE public.customers ADD CONSTRAINT customers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.ghl_webhook_events ADD CONSTRAINT ghl_webhook_events_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
ALTER TABLE public.ghl_webhook_events ADD CONSTRAINT ghl_webhook_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.ghl_webhook_events ADD CONSTRAINT ghl_webhook_events_webhook_source_id_fkey FOREIGN KEY (webhook_source_id) REFERENCES ghl_webhook_sources(id) ON DELETE CASCADE;
ALTER TABLE public.ghl_webhook_sources ADD CONSTRAINT ghl_webhook_sources_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
ALTER TABLE public.ghl_webhook_sources ADD CONSTRAINT ghl_webhook_sources_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
ALTER TABLE public.jobs ADD CONSTRAINT jobs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.laborers ADD CONSTRAINT laborers_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
ALTER TABLE public.laborers ADD CONSTRAINT laborers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.lead_appointments ADD CONSTRAINT lead_appointments_created_from_event_id_fkey FOREIGN KEY (created_from_event_id) REFERENCES ghl_webhook_events(id);
ALTER TABLE public.lead_appointments ADD CONSTRAINT lead_appointments_last_event_id_fkey FOREIGN KEY (last_event_id) REFERENCES ghl_webhook_events(id);
ALTER TABLE public.lead_appointments ADD CONSTRAINT lead_appointments_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
ALTER TABLE public.lead_appointments ADD CONSTRAINT lead_appointments_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
ALTER TABLE public.lead_appointments ADD CONSTRAINT lead_appointments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.leads ADD CONSTRAINT leads_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
ALTER TABLE public.leads ADD CONSTRAINT leads_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.misc_inventory ADD CONSTRAINT misc_inventory_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
ALTER TABLE public.misc_inventory ADD CONSTRAINT misc_inventory_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.organization_invitations ADD CONSTRAINT organization_invitations_accepted_by_fkey FOREIGN KEY (accepted_by) REFERENCES auth.users(id);
ALTER TABLE public.organization_invitations ADD CONSTRAINT organization_invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id);
ALTER TABLE public.organization_invitations ADD CONSTRAINT organization_invitations_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.organization_members ADD CONSTRAINT organization_members_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id);
ALTER TABLE public.organization_members ADD CONSTRAINT organization_members_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.organization_members ADD CONSTRAINT organization_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.organizations ADD CONSTRAINT organizations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public.pricing ADD CONSTRAINT pricing_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
ALTER TABLE public.pricing ADD CONSTRAINT pricing_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.pricing_variables ADD CONSTRAINT pricing_variables_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
ALTER TABLE public.pricing_variables ADD CONSTRAINT pricing_variables_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.products ADD CONSTRAINT products_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
ALTER TABLE public.products ADD CONSTRAINT products_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.referral_associates ADD CONSTRAINT referral_associates_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
ALTER TABLE public.referral_associates ADD CONSTRAINT referral_associates_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.referral_services ADD CONSTRAINT referral_services_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
ALTER TABLE public.referral_services ADD CONSTRAINT referral_services_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.route_planner_settings ADD CONSTRAINT route_planner_settings_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE public.route_planner_settings ADD CONSTRAINT route_planner_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE public.shopping_items ADD CONSTRAINT shopping_items_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.shopping_items ADD CONSTRAINT shopping_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.sync_log ADD CONSTRAINT sync_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.sync_queue ADD CONSTRAINT sync_queue_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.systems ADD CONSTRAINT systems_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
ALTER TABLE public.systems ADD CONSTRAINT systems_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.tint_inventory ADD CONSTRAINT tint_inventory_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.tint_inventory ADD CONSTRAINT tint_inventory_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.topcoat_inventory ADD CONSTRAINT topcoat_inventory_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
ALTER TABLE public.topcoat_inventory ADD CONSTRAINT topcoat_inventory_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_preferences ADD CONSTRAINT user_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX basecoat_inventory_org_unique ON public.basecoat_inventory USING btree (org_id) WHERE (org_id IS NOT NULL);
CREATE UNIQUE INDEX basecoat_inventory_user_personal_unique ON public.basecoat_inventory USING btree (user_id) WHERE (org_id IS NULL);
CREATE UNIQUE INDEX costs_org_unique ON public.costs USING btree (org_id) WHERE (org_id IS NOT NULL);
CREATE UNIQUE INDEX costs_user_personal_unique ON public.costs USING btree (user_id) WHERE (org_id IS NULL);
CREATE INDEX idx_base_coat_colors_deleted ON public.base_coat_colors USING btree (user_id, deleted) WHERE (deleted = false);
CREATE INDEX idx_base_coat_colors_org_id ON public.base_coat_colors USING btree (org_id) WHERE (org_id IS NOT NULL);
CREATE INDEX idx_base_coat_colors_user_id ON public.base_coat_colors USING btree (user_id);
CREATE INDEX idx_basecoat_inv_org_id ON public.basecoat_inventory USING btree (org_id) WHERE (org_id IS NOT NULL);
CREATE INDEX idx_basecoat_inventory_deleted ON public.basecoat_inventory USING btree (user_id, deleted) WHERE (deleted = false);
CREATE INDEX idx_basecoat_inventory_user_id ON public.basecoat_inventory USING btree (user_id);
CREATE INDEX idx_chip_blends_deleted ON public.chip_blends USING btree (user_id, deleted) WHERE (deleted = false);
CREATE INDEX idx_chip_blends_org_id ON public.chip_blends USING btree (org_id) WHERE (org_id IS NOT NULL);
CREATE INDEX idx_chip_blends_updated_at ON public.chip_blends USING btree (updated_at);
CREATE INDEX idx_chip_blends_user_id ON public.chip_blends USING btree (user_id);
CREATE INDEX idx_chip_inv_org_id ON public.chip_inventory USING btree (org_id) WHERE (org_id IS NOT NULL);
CREATE INDEX idx_chip_inventory_deleted ON public.chip_inventory USING btree (user_id, deleted) WHERE (deleted = false);
CREATE INDEX idx_chip_inventory_updated_at ON public.chip_inventory USING btree (updated_at);
CREATE INDEX idx_chip_inventory_user_id ON public.chip_inventory USING btree (user_id);
CREATE INDEX idx_costs_deleted ON public.costs USING btree (user_id, deleted) WHERE (deleted = false);
CREATE INDEX idx_costs_org_id ON public.costs USING btree (org_id) WHERE (org_id IS NOT NULL);
CREATE INDEX idx_costs_user_id ON public.costs USING btree (user_id);
CREATE INDEX idx_customers_org_id ON public.customers USING btree (org_id) WHERE (org_id IS NOT NULL);
CREATE INDEX idx_customers_updated_at ON public.customers USING btree (user_id, updated_at);
CREATE INDEX idx_customers_user_id ON public.customers USING btree (user_id);
CREATE INDEX idx_ghl_webhook_events_org_id ON public.ghl_webhook_events USING btree (org_id);
CREATE INDEX idx_ghl_webhook_events_received_at ON public.ghl_webhook_events USING btree (received_at);
CREATE UNIQUE INDEX idx_ghl_webhook_events_source_dedupe ON public.ghl_webhook_events USING btree (webhook_source_id, dedupe_key);
CREATE INDEX idx_ghl_webhook_events_status ON public.ghl_webhook_events USING btree (processing_status);
CREATE INDEX idx_ghl_webhook_events_user_id ON public.ghl_webhook_events USING btree (user_id);
CREATE INDEX idx_ghl_webhook_sources_active ON public.ghl_webhook_sources USING btree (is_active) WHERE (is_active = true);
CREATE INDEX idx_ghl_webhook_sources_org_id ON public.ghl_webhook_sources USING btree (org_id);
CREATE INDEX idx_ghl_webhook_sources_user_id ON public.ghl_webhook_sources USING btree (user_id);
CREATE INDEX idx_jobs_deleted ON public.jobs USING btree (user_id, deleted) WHERE (deleted = false);
CREATE INDEX idx_jobs_install_date ON public.jobs USING btree (user_id, install_date);
CREATE INDEX idx_jobs_lead_id ON public.jobs USING btree (lead_id) WHERE (lead_id IS NOT NULL);
CREATE INDEX idx_jobs_org_estimate_date ON public.jobs USING btree (org_id, estimate_date) WHERE ((org_id IS NOT NULL) AND (estimate_date IS NOT NULL));
CREATE INDEX idx_jobs_org_id ON public.jobs USING btree (org_id) WHERE (org_id IS NOT NULL);
CREATE INDEX idx_jobs_org_install_date ON public.jobs USING btree (org_id, install_date) WHERE (org_id IS NOT NULL);
CREATE INDEX idx_jobs_org_updated_at ON public.jobs USING btree (org_id, updated_at) WHERE (org_id IS NOT NULL);
CREATE INDEX idx_jobs_status ON public.jobs USING btree (user_id, status);
CREATE INDEX idx_jobs_synced ON public.jobs USING btree (synced);
CREATE INDEX idx_jobs_tags_gin ON public.jobs USING gin (tags);
CREATE INDEX idx_jobs_updated_at ON public.jobs USING btree (updated_at);
CREATE INDEX idx_jobs_user_estimate_date_personal ON public.jobs USING btree (user_id, estimate_date) WHERE ((org_id IS NULL) AND (estimate_date IS NOT NULL));
CREATE INDEX idx_jobs_user_id ON public.jobs USING btree (user_id);
CREATE INDEX idx_jobs_user_updated_at_personal ON public.jobs USING btree (user_id, updated_at) WHERE (org_id IS NULL);
CREATE INDEX idx_laborers_deleted ON public.laborers USING btree (user_id, deleted) WHERE (deleted = false);
CREATE INDEX idx_laborers_org_id ON public.laborers USING btree (org_id) WHERE (org_id IS NOT NULL);
CREATE INDEX idx_laborers_updated_at ON public.laborers USING btree (updated_at);
CREATE INDEX idx_laborers_user_id ON public.laborers USING btree (user_id);
CREATE INDEX idx_lead_appointments_lead_id ON public.lead_appointments USING btree (lead_id);
CREATE UNIQUE INDEX idx_lead_appointments_org_ghl_id ON public.lead_appointments USING btree (org_id, ghl_appointment_id) WHERE ((org_id IS NOT NULL) AND (ghl_appointment_id IS NOT NULL));
CREATE INDEX idx_lead_appointments_scheduled_start_at ON public.lead_appointments USING btree (scheduled_start_at);
CREATE INDEX idx_lead_appointments_updated_at ON public.lead_appointments USING btree (user_id, updated_at);
CREATE UNIQUE INDEX idx_lead_appointments_user_ghl_id ON public.lead_appointments USING btree (user_id, ghl_appointment_id) WHERE ((org_id IS NULL) AND (ghl_appointment_id IS NOT NULL));
CREATE UNIQUE INDEX idx_leads_org_ghl_contact_id ON public.leads USING btree (org_id, ghl_contact_id) WHERE ((org_id IS NOT NULL) AND (ghl_contact_id IS NOT NULL));
CREATE INDEX idx_leads_org_id ON public.leads USING btree (org_id);
CREATE INDEX idx_leads_source ON public.leads USING btree (user_id, source);
CREATE INDEX idx_leads_stage ON public.leads USING btree (user_id, stage);
CREATE INDEX idx_leads_updated_at ON public.leads USING btree (user_id, updated_at);
CREATE UNIQUE INDEX idx_leads_user_ghl_contact_id ON public.leads USING btree (user_id, ghl_contact_id) WHERE ((org_id IS NULL) AND (ghl_contact_id IS NOT NULL));
CREATE INDEX idx_leads_user_id ON public.leads USING btree (user_id);
CREATE INDEX idx_misc_inv_org_id ON public.misc_inventory USING btree (org_id) WHERE (org_id IS NOT NULL);
CREATE INDEX idx_misc_inventory_deleted ON public.misc_inventory USING btree (user_id, deleted) WHERE (deleted = false);
CREATE INDEX idx_misc_inventory_user_id ON public.misc_inventory USING btree (user_id);
CREATE INDEX idx_org_invitations_code ON public.organization_invitations USING btree (invite_code);
CREATE INDEX idx_org_invitations_org_id ON public.organization_invitations USING btree (org_id);
CREATE INDEX idx_org_members_org_id ON public.organization_members USING btree (org_id);
CREATE INDEX idx_org_members_user_id ON public.organization_members USING btree (user_id);
CREATE INDEX idx_pricing_variables_deleted ON public.pricing_variables USING btree (user_id, deleted) WHERE (deleted = false);
CREATE INDEX idx_pricing_variables_updated_at ON public.pricing_variables USING btree (updated_at);
CREATE INDEX idx_pricing_variables_user_id ON public.pricing_variables USING btree (user_id);
CREATE INDEX idx_pricing_vars_org_id ON public.pricing_variables USING btree (org_id) WHERE (org_id IS NOT NULL);
CREATE INDEX idx_products_org_id ON public.products USING btree (org_id) WHERE (org_id IS NOT NULL);
CREATE INDEX idx_products_updated_at ON public.products USING btree (user_id, updated_at);
CREATE INDEX idx_products_user_id ON public.products USING btree (user_id);
CREATE INDEX idx_referral_associates_org_id ON public.referral_associates USING btree (org_id);
CREATE INDEX idx_referral_associates_updated_at ON public.referral_associates USING btree (user_id, updated_at);
CREATE INDEX idx_referral_associates_user_id ON public.referral_associates USING btree (user_id);
CREATE INDEX idx_referral_services_org_id ON public.referral_services USING btree (org_id);
CREATE INDEX idx_referral_services_updated_at ON public.referral_services USING btree (user_id, updated_at);
CREATE INDEX idx_referral_services_user_id ON public.referral_services USING btree (user_id);
CREATE INDEX idx_sync_log_user_id ON public.sync_log USING btree (user_id);
CREATE INDEX idx_sync_queue_processed ON public.sync_queue USING btree (processed_at) WHERE (processed_at IS NULL);
CREATE INDEX idx_sync_queue_user_id ON public.sync_queue USING btree (user_id);
CREATE INDEX idx_systems_deleted ON public.systems USING btree (user_id, deleted) WHERE (deleted = false);
CREATE INDEX idx_systems_org_id ON public.systems USING btree (org_id) WHERE (org_id IS NOT NULL);
CREATE INDEX idx_systems_updated_at ON public.systems USING btree (updated_at);
CREATE INDEX idx_systems_user_id ON public.systems USING btree (user_id);
CREATE INDEX idx_topcoat_inv_org_id ON public.topcoat_inventory USING btree (org_id) WHERE (org_id IS NOT NULL);
CREATE INDEX idx_topcoat_inventory_deleted ON public.topcoat_inventory USING btree (user_id, deleted) WHERE (deleted = false);
CREATE INDEX idx_topcoat_inventory_user_id ON public.topcoat_inventory USING btree (user_id);
CREATE UNIQUE INDEX misc_inventory_org_unique ON public.misc_inventory USING btree (org_id) WHERE (org_id IS NOT NULL);
CREATE UNIQUE INDEX misc_inventory_user_personal_unique ON public.misc_inventory USING btree (user_id) WHERE (org_id IS NULL);
CREATE UNIQUE INDEX topcoat_inventory_org_unique ON public.topcoat_inventory USING btree (org_id) WHERE (org_id IS NOT NULL);
CREATE UNIQUE INDEX topcoat_inventory_user_personal_unique ON public.topcoat_inventory USING btree (user_id) WHERE (org_id IS NULL);

CREATE TRIGGER preserve_org_id_trigger BEFORE UPDATE ON public.ad_spend FOR EACH ROW EXECUTE FUNCTION preserve_org_id();
CREATE TRIGGER preserve_user_id_trigger BEFORE UPDATE ON public.ad_spend FOR EACH ROW EXECUTE FUNCTION preserve_user_id();
CREATE TRIGGER sync_lww_guard_ad_spend BEFORE INSERT OR UPDATE ON public.ad_spend FOR EACH ROW EXECUTE FUNCTION sync_lww_guard();
CREATE TRIGGER preserve_org_id_trigger BEFORE UPDATE ON public.base_coat_colors FOR EACH ROW EXECUTE FUNCTION preserve_org_id();
CREATE TRIGGER preserve_user_id_trigger BEFORE UPDATE ON public.base_coat_colors FOR EACH ROW EXECUTE FUNCTION preserve_user_id();
CREATE TRIGGER sync_lww_guard_base_coat_colors BEFORE INSERT OR UPDATE ON public.base_coat_colors FOR EACH ROW EXECUTE FUNCTION sync_lww_guard();
CREATE TRIGGER preserve_org_id_trigger BEFORE UPDATE ON public.basecoat_inventory FOR EACH ROW EXECUTE FUNCTION preserve_org_id();
CREATE TRIGGER preserve_user_id_trigger BEFORE UPDATE ON public.basecoat_inventory FOR EACH ROW EXECUTE FUNCTION preserve_user_id();
CREATE TRIGGER sync_lww_guard_basecoat_inventory BEFORE INSERT OR UPDATE ON public.basecoat_inventory FOR EACH ROW EXECUTE FUNCTION sync_lww_guard();
CREATE TRIGGER preserve_org_id_trigger BEFORE UPDATE ON public.chip_blends FOR EACH ROW EXECUTE FUNCTION preserve_org_id();
CREATE TRIGGER preserve_user_id_trigger BEFORE UPDATE ON public.chip_blends FOR EACH ROW EXECUTE FUNCTION preserve_user_id();
CREATE TRIGGER sync_lww_guard_chip_blends BEFORE INSERT OR UPDATE ON public.chip_blends FOR EACH ROW EXECUTE FUNCTION sync_lww_guard();
CREATE TRIGGER preserve_org_id_trigger BEFORE UPDATE ON public.chip_inventory FOR EACH ROW EXECUTE FUNCTION preserve_org_id();
CREATE TRIGGER preserve_user_id_trigger BEFORE UPDATE ON public.chip_inventory FOR EACH ROW EXECUTE FUNCTION preserve_user_id();
CREATE TRIGGER sync_lww_guard_chip_inventory BEFORE INSERT OR UPDATE ON public.chip_inventory FOR EACH ROW EXECUTE FUNCTION sync_lww_guard();
CREATE TRIGGER preserve_org_id_trigger BEFORE UPDATE ON public.coating_inventory FOR EACH ROW EXECUTE FUNCTION preserve_org_id();
CREATE TRIGGER preserve_user_id_trigger BEFORE UPDATE ON public.coating_inventory FOR EACH ROW EXECUTE FUNCTION preserve_user_id();
CREATE TRIGGER sync_lww_guard_coating_inventory BEFORE INSERT OR UPDATE ON public.coating_inventory FOR EACH ROW EXECUTE FUNCTION sync_lww_guard();
CREATE TRIGGER preserve_org_id_trigger BEFORE UPDATE ON public.comm_templates FOR EACH ROW EXECUTE FUNCTION preserve_org_id();
CREATE TRIGGER sync_lww_guard_comm_templates BEFORE INSERT OR UPDATE ON public.comm_templates FOR EACH ROW EXECUTE FUNCTION sync_lww_guard();
CREATE TRIGGER preserve_org_id_trigger BEFORE UPDATE ON public.costs FOR EACH ROW EXECUTE FUNCTION preserve_org_id();
CREATE TRIGGER preserve_user_id_trigger BEFORE UPDATE ON public.costs FOR EACH ROW EXECUTE FUNCTION preserve_user_id();
CREATE TRIGGER sync_lww_guard_costs BEFORE INSERT OR UPDATE ON public.costs FOR EACH ROW EXECUTE FUNCTION sync_lww_guard();
CREATE TRIGGER preserve_org_id_trigger BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION preserve_org_id();
CREATE TRIGGER preserve_user_id_trigger BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION preserve_user_id();
CREATE TRIGGER sync_lww_guard_customers BEFORE INSERT OR UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION sync_lww_guard();
CREATE TRIGGER preserve_org_id_trigger BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION preserve_org_id();
CREATE TRIGGER preserve_user_id_trigger BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION preserve_user_id();
CREATE TRIGGER sync_lww_guard_jobs BEFORE INSERT OR UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION sync_lww_guard();
CREATE TRIGGER preserve_org_id_trigger BEFORE UPDATE ON public.laborers FOR EACH ROW EXECUTE FUNCTION preserve_org_id();
CREATE TRIGGER preserve_user_id_trigger BEFORE UPDATE ON public.laborers FOR EACH ROW EXECUTE FUNCTION preserve_user_id();
CREATE TRIGGER sync_lww_guard_laborers BEFORE INSERT OR UPDATE ON public.laborers FOR EACH ROW EXECUTE FUNCTION sync_lww_guard();
CREATE TRIGGER preserve_org_id_trigger BEFORE UPDATE ON public.lead_appointments FOR EACH ROW EXECUTE FUNCTION preserve_org_id();
CREATE TRIGGER preserve_user_id_trigger BEFORE UPDATE ON public.lead_appointments FOR EACH ROW EXECUTE FUNCTION preserve_user_id();
CREATE TRIGGER sync_lww_guard_lead_appointments BEFORE INSERT OR UPDATE ON public.lead_appointments FOR EACH ROW EXECUTE FUNCTION sync_lww_guard();
CREATE TRIGGER preserve_org_id_trigger BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION preserve_org_id();
CREATE TRIGGER preserve_user_id_trigger BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION preserve_user_id();
CREATE TRIGGER sync_lww_guard_leads BEFORE INSERT OR UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION sync_lww_guard();
CREATE TRIGGER preserve_org_id_trigger BEFORE UPDATE ON public.misc_inventory FOR EACH ROW EXECUTE FUNCTION preserve_org_id();
CREATE TRIGGER preserve_user_id_trigger BEFORE UPDATE ON public.misc_inventory FOR EACH ROW EXECUTE FUNCTION preserve_user_id();
CREATE TRIGGER sync_lww_guard_misc_inventory BEFORE INSERT OR UPDATE ON public.misc_inventory FOR EACH ROW EXECUTE FUNCTION sync_lww_guard();
CREATE TRIGGER preserve_org_id_trigger BEFORE UPDATE ON public.pricing FOR EACH ROW EXECUTE FUNCTION preserve_org_id();
CREATE TRIGGER preserve_user_id_trigger BEFORE UPDATE ON public.pricing FOR EACH ROW EXECUTE FUNCTION preserve_user_id();
CREATE TRIGGER sync_lww_guard_pricing BEFORE INSERT OR UPDATE ON public.pricing FOR EACH ROW EXECUTE FUNCTION sync_lww_guard();
CREATE TRIGGER preserve_org_id_trigger BEFORE UPDATE ON public.pricing_variables FOR EACH ROW EXECUTE FUNCTION preserve_org_id();
CREATE TRIGGER preserve_user_id_trigger BEFORE UPDATE ON public.pricing_variables FOR EACH ROW EXECUTE FUNCTION preserve_user_id();
CREATE TRIGGER sync_lww_guard_pricing_variables BEFORE INSERT OR UPDATE ON public.pricing_variables FOR EACH ROW EXECUTE FUNCTION sync_lww_guard();
CREATE TRIGGER preserve_org_id_trigger BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION preserve_org_id();
CREATE TRIGGER preserve_user_id_trigger BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION preserve_user_id();
CREATE TRIGGER sync_lww_guard_products BEFORE INSERT OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION sync_lww_guard();
CREATE TRIGGER preserve_org_id_trigger BEFORE UPDATE ON public.referral_associates FOR EACH ROW EXECUTE FUNCTION preserve_org_id();
CREATE TRIGGER preserve_user_id_trigger BEFORE UPDATE ON public.referral_associates FOR EACH ROW EXECUTE FUNCTION preserve_user_id();
CREATE TRIGGER sync_lww_guard_referral_associates BEFORE INSERT OR UPDATE ON public.referral_associates FOR EACH ROW EXECUTE FUNCTION sync_lww_guard();
CREATE TRIGGER preserve_org_id_trigger BEFORE UPDATE ON public.referral_services FOR EACH ROW EXECUTE FUNCTION preserve_org_id();
CREATE TRIGGER preserve_user_id_trigger BEFORE UPDATE ON public.referral_services FOR EACH ROW EXECUTE FUNCTION preserve_user_id();
CREATE TRIGGER sync_lww_guard_referral_services BEFORE INSERT OR UPDATE ON public.referral_services FOR EACH ROW EXECUTE FUNCTION sync_lww_guard();
CREATE TRIGGER preserve_org_id_trigger BEFORE UPDATE ON public.shopping_items FOR EACH ROW EXECUTE FUNCTION preserve_org_id();
CREATE TRIGGER preserve_user_id_trigger BEFORE UPDATE ON public.shopping_items FOR EACH ROW EXECUTE FUNCTION preserve_user_id();
CREATE TRIGGER sync_lww_guard_shopping_items BEFORE INSERT OR UPDATE ON public.shopping_items FOR EACH ROW EXECUTE FUNCTION sync_lww_guard();
CREATE TRIGGER preserve_org_id_trigger BEFORE UPDATE ON public.systems FOR EACH ROW EXECUTE FUNCTION preserve_org_id();
CREATE TRIGGER preserve_user_id_trigger BEFORE UPDATE ON public.systems FOR EACH ROW EXECUTE FUNCTION preserve_user_id();
CREATE TRIGGER sync_lww_guard_systems BEFORE INSERT OR UPDATE ON public.systems FOR EACH ROW EXECUTE FUNCTION sync_lww_guard();
CREATE TRIGGER preserve_org_id_trigger BEFORE UPDATE ON public.tint_inventory FOR EACH ROW EXECUTE FUNCTION preserve_org_id();
CREATE TRIGGER preserve_user_id_trigger BEFORE UPDATE ON public.tint_inventory FOR EACH ROW EXECUTE FUNCTION preserve_user_id();
CREATE TRIGGER sync_lww_guard_tint_inventory BEFORE INSERT OR UPDATE ON public.tint_inventory FOR EACH ROW EXECUTE FUNCTION sync_lww_guard();
CREATE TRIGGER preserve_org_id_trigger BEFORE UPDATE ON public.topcoat_inventory FOR EACH ROW EXECUTE FUNCTION preserve_org_id();
CREATE TRIGGER preserve_user_id_trigger BEFORE UPDATE ON public.topcoat_inventory FOR EACH ROW EXECUTE FUNCTION preserve_user_id();
CREATE TRIGGER sync_lww_guard_topcoat_inventory BEFORE INSERT OR UPDATE ON public.topcoat_inventory FOR EACH ROW EXECUTE FUNCTION sync_lww_guard();
CREATE TRIGGER update_ghl_webhook_events_updated_at BEFORE UPDATE ON public.ghl_webhook_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ghl_webhook_sources_updated_at BEFORE UPDATE ON public.ghl_webhook_sources FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON public.user_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.ad_spend ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.base_coat_colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.basecoat_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chip_blends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chip_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coating_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comm_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghl_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghl_webhook_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laborers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.misc_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_associates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_planner_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tint_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topcoat_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Org-scoped data tables: members read the whole org; writes need org_can_write() permission
CREATE POLICY "Org-aware delete" ON public.ad_spend AS PERMISSIVE FOR DELETE TO authenticated
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND is_org_admin(org_id))));
CREATE POLICY "Org-aware insert" ON public.ad_spend AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((user_id = auth.uid()) AND ((org_id IS NULL) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{reporting}'::text[])))));
CREATE POLICY "Org-aware select" ON public.ad_spend AS PERMISSIVE FOR SELECT TO public
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND is_org_member(org_id))));
CREATE POLICY "Org-aware update" ON public.ad_spend AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{reporting}'::text[]))))
  WITH CHECK ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{reporting}'::text[]))));
CREATE POLICY "Org-aware delete" ON public.base_coat_colors AS PERMISSIVE FOR DELETE TO authenticated
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND is_org_admin(org_id))));
CREATE POLICY "Org-aware insert" ON public.base_coat_colors AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((user_id = auth.uid()) AND ((org_id IS NULL) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{settings}'::text[])))));
CREATE POLICY "Org-aware select" ON public.base_coat_colors AS PERMISSIVE FOR SELECT TO public
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND is_org_member(org_id))));
CREATE POLICY "Org-aware update" ON public.base_coat_colors AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{settings}'::text[]))))
  WITH CHECK ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{settings}'::text[]))));
CREATE POLICY "Org-aware delete" ON public.basecoat_inventory AS PERMISSIVE FOR DELETE TO authenticated
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND is_org_admin(org_id))));
CREATE POLICY "Org-aware insert" ON public.basecoat_inventory AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((user_id = auth.uid()) AND ((org_id IS NULL) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{inventory,jobs}'::text[])))));
CREATE POLICY "Org-aware select" ON public.basecoat_inventory AS PERMISSIVE FOR SELECT TO public
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND is_org_member(org_id))));
CREATE POLICY "Org-aware update" ON public.basecoat_inventory AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{inventory,jobs}'::text[]))))
  WITH CHECK ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{inventory,jobs}'::text[]))));
CREATE POLICY "Org-aware delete" ON public.chip_blends AS PERMISSIVE FOR DELETE TO authenticated
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND is_org_admin(org_id))));
CREATE POLICY "Org-aware insert" ON public.chip_blends AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((user_id = auth.uid()) AND ((org_id IS NULL) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{chipBlends,inventory,jobs}'::text[])))));
CREATE POLICY "Org-aware select" ON public.chip_blends AS PERMISSIVE FOR SELECT TO public
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND is_org_member(org_id))));
CREATE POLICY "Org-aware update" ON public.chip_blends AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{chipBlends,inventory,jobs}'::text[]))))
  WITH CHECK ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{chipBlends,inventory,jobs}'::text[]))));
CREATE POLICY "Org-aware delete" ON public.chip_inventory AS PERMISSIVE FOR DELETE TO authenticated
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND is_org_admin(org_id))));
CREATE POLICY "Org-aware insert" ON public.chip_inventory AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((user_id = auth.uid()) AND ((org_id IS NULL) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{inventory,jobs}'::text[])))));
CREATE POLICY "Org-aware select" ON public.chip_inventory AS PERMISSIVE FOR SELECT TO public
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND is_org_member(org_id))));
CREATE POLICY "Org-aware update" ON public.chip_inventory AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{inventory,jobs}'::text[]))))
  WITH CHECK ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{inventory,jobs}'::text[]))));
CREATE POLICY "Org-aware delete" ON public.coating_inventory AS PERMISSIVE FOR DELETE TO authenticated
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND is_org_admin(org_id))));
CREATE POLICY "Org-aware insert" ON public.coating_inventory AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((user_id = auth.uid()) AND ((org_id IS NULL) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{inventory,jobs}'::text[])))));
CREATE POLICY "Org-aware select" ON public.coating_inventory AS PERMISSIVE FOR SELECT TO public
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND is_org_member(org_id))));
CREATE POLICY "Org-aware update" ON public.coating_inventory AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{inventory,jobs}'::text[]))))
  WITH CHECK ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{inventory,jobs}'::text[]))));
CREATE POLICY "Org-aware delete" ON public.costs AS PERMISSIVE FOR DELETE TO authenticated
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND is_org_admin(org_id))));
CREATE POLICY "Org-aware insert" ON public.costs AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((user_id = auth.uid()) AND ((org_id IS NULL) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{costs}'::text[])))));
CREATE POLICY "Org-aware select" ON public.costs AS PERMISSIVE FOR SELECT TO public
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND is_org_member(org_id))));
CREATE POLICY "Org-aware update" ON public.costs AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{costs}'::text[]))))
  WITH CHECK ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{costs}'::text[]))));
CREATE POLICY "Org-aware delete" ON public.customers AS PERMISSIVE FOR DELETE TO authenticated
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND is_org_admin(org_id))));
CREATE POLICY "Org-aware insert" ON public.customers AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((user_id = auth.uid()) AND ((org_id IS NULL) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{customers,jobs}'::text[])))));
CREATE POLICY "Org-aware select" ON public.customers AS PERMISSIVE FOR SELECT TO public
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND is_org_member(org_id))));
CREATE POLICY "Org-aware update" ON public.customers AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{customers,jobs}'::text[]))))
  WITH CHECK ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{customers,jobs}'::text[]))));
CREATE POLICY "Org-aware delete" ON public.jobs AS PERMISSIVE FOR DELETE TO authenticated
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND is_org_admin(org_id))));
CREATE POLICY "Org-aware insert" ON public.jobs AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((user_id = auth.uid()) AND ((org_id IS NULL) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{jobs}'::text[])))));
CREATE POLICY "Org-aware select" ON public.jobs AS PERMISSIVE FOR SELECT TO public
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND is_org_member(org_id))));
CREATE POLICY "Org-aware update" ON public.jobs AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{jobs}'::text[]))))
  WITH CHECK ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{jobs}'::text[]))));
CREATE POLICY "Org-aware delete" ON public.laborers AS PERMISSIVE FOR DELETE TO authenticated
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND is_org_admin(org_id))));
CREATE POLICY "Org-aware insert" ON public.laborers AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((user_id = auth.uid()) AND ((org_id IS NULL) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{laborers}'::text[])))));
CREATE POLICY "Org-aware select" ON public.laborers AS PERMISSIVE FOR SELECT TO public
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND is_org_member(org_id))));
CREATE POLICY "Org-aware update" ON public.laborers AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{laborers}'::text[]))))
  WITH CHECK ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{laborers}'::text[]))));
CREATE POLICY "Org-aware delete" ON public.lead_appointments AS PERMISSIVE FOR DELETE TO authenticated
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND is_org_admin(org_id))));
CREATE POLICY "Org-aware insert" ON public.lead_appointments AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((user_id = auth.uid()) AND ((org_id IS NULL) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{customers,reporting,jobs}'::text[])))));
CREATE POLICY "Org-aware select" ON public.lead_appointments AS PERMISSIVE FOR SELECT TO public
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND is_org_member(org_id))));
CREATE POLICY "Org-aware update" ON public.lead_appointments AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{customers,reporting,jobs}'::text[]))))
  WITH CHECK ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{customers,reporting,jobs}'::text[]))));
CREATE POLICY "Org-aware delete" ON public.leads AS PERMISSIVE FOR DELETE TO authenticated
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND is_org_admin(org_id))));
CREATE POLICY "Org-aware insert" ON public.leads AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((user_id = auth.uid()) AND ((org_id IS NULL) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{customers,reporting,jobs}'::text[])))));
CREATE POLICY "Org-aware select" ON public.leads AS PERMISSIVE FOR SELECT TO public
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND is_org_member(org_id))));
CREATE POLICY "Org-aware update" ON public.leads AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{customers,reporting,jobs}'::text[]))))
  WITH CHECK ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{customers,reporting,jobs}'::text[]))));
CREATE POLICY "Org-aware delete" ON public.misc_inventory AS PERMISSIVE FOR DELETE TO authenticated
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND is_org_admin(org_id))));
CREATE POLICY "Org-aware insert" ON public.misc_inventory AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((user_id = auth.uid()) AND ((org_id IS NULL) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{inventory,jobs}'::text[])))));
CREATE POLICY "Org-aware select" ON public.misc_inventory AS PERMISSIVE FOR SELECT TO public
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND is_org_member(org_id))));
CREATE POLICY "Org-aware update" ON public.misc_inventory AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{inventory,jobs}'::text[]))))
  WITH CHECK ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{inventory,jobs}'::text[]))));
CREATE POLICY "Org-aware delete" ON public.pricing AS PERMISSIVE FOR DELETE TO authenticated
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND is_org_admin(org_id))));
CREATE POLICY "Org-aware insert" ON public.pricing AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((user_id = auth.uid()) AND ((org_id IS NULL) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{pricing,settings}'::text[])))));
CREATE POLICY "Org-aware select" ON public.pricing AS PERMISSIVE FOR SELECT TO public
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND is_org_member(org_id))));
CREATE POLICY "Org-aware update" ON public.pricing AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{pricing,settings}'::text[]))))
  WITH CHECK ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{pricing,settings}'::text[]))));
CREATE POLICY "Org-aware delete" ON public.pricing_variables AS PERMISSIVE FOR DELETE TO authenticated
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND is_org_admin(org_id))));
CREATE POLICY "Org-aware insert" ON public.pricing_variables AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((user_id = auth.uid()) AND ((org_id IS NULL) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{pricing}'::text[])))));
CREATE POLICY "Org-aware select" ON public.pricing_variables AS PERMISSIVE FOR SELECT TO public
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND is_org_member(org_id))));
CREATE POLICY "Org-aware update" ON public.pricing_variables AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{pricing}'::text[]))))
  WITH CHECK ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{pricing}'::text[]))));
CREATE POLICY "Org-aware delete" ON public.products AS PERMISSIVE FOR DELETE TO authenticated
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND is_org_admin(org_id))));
CREATE POLICY "Org-aware insert" ON public.products AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((user_id = auth.uid()) AND ((org_id IS NULL) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{products}'::text[])))));
CREATE POLICY "Org-aware select" ON public.products AS PERMISSIVE FOR SELECT TO public
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND is_org_member(org_id))));
CREATE POLICY "Org-aware update" ON public.products AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{products}'::text[]))))
  WITH CHECK ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{products}'::text[]))));
CREATE POLICY "Org-aware delete" ON public.referral_associates AS PERMISSIVE FOR DELETE TO authenticated
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND is_org_admin(org_id))));
CREATE POLICY "Org-aware insert" ON public.referral_associates AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((user_id = auth.uid()) AND ((org_id IS NULL) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{referralAssociates}'::text[])))));
CREATE POLICY "Org-aware select" ON public.referral_associates AS PERMISSIVE FOR SELECT TO public
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND is_org_member(org_id))));
CREATE POLICY "Org-aware update" ON public.referral_associates AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{referralAssociates}'::text[]))))
  WITH CHECK ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{referralAssociates}'::text[]))));
CREATE POLICY "Org-aware delete" ON public.referral_services AS PERMISSIVE FOR DELETE TO authenticated
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND is_org_admin(org_id))));
CREATE POLICY "Org-aware insert" ON public.referral_services AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((user_id = auth.uid()) AND ((org_id IS NULL) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{referralAssociates}'::text[])))));
CREATE POLICY "Org-aware select" ON public.referral_services AS PERMISSIVE FOR SELECT TO public
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND is_org_member(org_id))));
CREATE POLICY "Org-aware update" ON public.referral_services AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{referralAssociates}'::text[]))))
  WITH CHECK ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{referralAssociates}'::text[]))));
CREATE POLICY "Org-aware delete" ON public.shopping_items AS PERMISSIVE FOR DELETE TO authenticated
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND is_org_admin(org_id))));
CREATE POLICY "Org-aware insert" ON public.shopping_items AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((user_id = auth.uid()) AND ((org_id IS NULL) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{inventory}'::text[])))));
CREATE POLICY "Org-aware select" ON public.shopping_items AS PERMISSIVE FOR SELECT TO public
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND is_org_member(org_id))));
CREATE POLICY "Org-aware update" ON public.shopping_items AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{inventory}'::text[]))))
  WITH CHECK ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{inventory}'::text[]))));
CREATE POLICY "Org-aware delete" ON public.systems AS PERMISSIVE FOR DELETE TO authenticated
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND is_org_admin(org_id))));
CREATE POLICY "Org-aware insert" ON public.systems AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((user_id = auth.uid()) AND ((org_id IS NULL) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{chipSystems}'::text[])))));
CREATE POLICY "Org-aware select" ON public.systems AS PERMISSIVE FOR SELECT TO public
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND is_org_member(org_id))));
CREATE POLICY "Org-aware update" ON public.systems AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{chipSystems}'::text[]))))
  WITH CHECK ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{chipSystems}'::text[]))));
CREATE POLICY "Org-aware delete" ON public.tint_inventory AS PERMISSIVE FOR DELETE TO authenticated
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND is_org_admin(org_id))));
CREATE POLICY "Org-aware insert" ON public.tint_inventory AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((user_id = auth.uid()) AND ((org_id IS NULL) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{inventory,jobs}'::text[])))));
CREATE POLICY "Org-aware select" ON public.tint_inventory AS PERMISSIVE FOR SELECT TO public
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND is_org_member(org_id))));
CREATE POLICY "Org-aware update" ON public.tint_inventory AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{inventory,jobs}'::text[]))))
  WITH CHECK ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{inventory,jobs}'::text[]))));
CREATE POLICY "Org-aware delete" ON public.topcoat_inventory AS PERMISSIVE FOR DELETE TO authenticated
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND is_org_admin(org_id))));
CREATE POLICY "Org-aware insert" ON public.topcoat_inventory AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((user_id = auth.uid()) AND ((org_id IS NULL) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{inventory,jobs}'::text[])))));
CREATE POLICY "Org-aware select" ON public.topcoat_inventory AS PERMISSIVE FOR SELECT TO public
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND is_org_member(org_id))));
CREATE POLICY "Org-aware update" ON public.topcoat_inventory AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{inventory,jobs}'::text[]))))
  WITH CHECK ((((org_id IS NULL) AND (user_id = auth.uid())) OR ((org_id IS NOT NULL) AND org_can_write(org_id, '{inventory,jobs}'::text[]))));

-- Everything else
CREATE POLICY "Users can manage their own comm templates" ON public.comm_templates AS PERMISSIVE FOR ALL TO public
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users can view their own GHL webhook events" ON public.ghl_webhook_events AS PERMISSIVE FOR SELECT TO authenticated
  USING (((user_id = ( SELECT auth.uid() AS uid)) OR ((org_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM organization_members
  WHERE ((organization_members.org_id = ghl_webhook_events.org_id) AND (organization_members.user_id = ( SELECT auth.uid() AS uid))))))));
CREATE POLICY "Users can manage their own GHL webhook sources" ON public.ghl_webhook_sources AS PERMISSIVE FOR ALL TO authenticated
  USING ((((org_id IS NULL) AND (user_id = ( SELECT auth.uid() AS uid))) OR ((org_id IS NOT NULL) AND is_org_admin(org_id))))
  WITH CHECK ((((org_id IS NULL) AND (user_id = ( SELECT auth.uid() AS uid))) OR ((org_id IS NOT NULL) AND is_org_admin(org_id))));
CREATE POLICY "Admins can create invitations" ON public.organization_invitations AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (is_org_admin(org_id));
CREATE POLICY "Admins can revoke invitations" ON public.organization_invitations AS PERMISSIVE FOR DELETE TO public
  USING (is_org_admin(org_id));
CREATE POLICY "Admins can update invitations" ON public.organization_invitations AS PERMISSIVE FOR UPDATE TO public
  USING (is_org_admin(org_id))
  WITH CHECK (is_org_admin(org_id));
CREATE POLICY "Admins can view org invitations" ON public.organization_invitations AS PERMISSIVE FOR SELECT TO public
  USING (is_org_admin(org_id));
CREATE POLICY "Admins can update member roles" ON public.organization_members AS PERMISSIVE FOR UPDATE TO public
  USING (is_org_admin(org_id))
  WITH CHECK (is_org_admin(org_id));
CREATE POLICY "Admins or self can remove" ON public.organization_members AS PERMISSIVE FOR DELETE TO public
  USING ((is_org_admin(org_id) OR (auth.uid() = user_id)));
CREATE POLICY "Members can view org members" ON public.organization_members AS PERMISSIVE FOR SELECT TO public
  USING (is_org_member(org_id));
CREATE POLICY "Admins can update their org" ON public.organizations AS PERMISSIVE FOR UPDATE TO public
  USING (is_org_admin(id))
  WITH CHECK (is_org_admin(id));
CREATE POLICY "Members can view their org" ON public.organizations AS PERMISSIVE FOR SELECT TO public
  USING ((is_org_member(id) OR (auth.uid() = created_by)));
CREATE POLICY "Users can manage their own route planner settings" ON public.route_planner_settings AS PERMISSIVE FOR ALL TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can insert own sync log" ON public.sync_log AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can view own sync log" ON public.sync_log AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));
CREATE POLICY "Users can delete own sync queue" ON public.sync_queue AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));
CREATE POLICY "Users can insert own sync queue" ON public.sync_queue AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can update own sync queue" ON public.sync_queue AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can view own sync queue" ON public.sync_queue AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));
CREATE POLICY "Users can delete own preferences" ON public.user_preferences AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));
CREATE POLICY "Users can insert own preferences" ON public.user_preferences AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can update own preferences" ON public.user_preferences AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can view own preferences" ON public.user_preferences AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));

-- Table privileges are Supabase's defaults; row access is governed by the RLS policies above
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;

-- Functions: EXECUTE for everyone (Supabase's defaults), except these, which are signed-in only
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.accept_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_invite(text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.create_organization(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_organization(text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.lookup_invite_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lookup_invite_by_code(text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.org_can_write(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_can_write(uuid, text[]) TO authenticated, service_role;

COMMENT ON TABLE public.ad_spend IS 'Manually-entered advertising spend per calendar month (lead tracking report)';
COMMENT ON TABLE public.base_coat_colors IS 'User-managed base coat color options';
COMMENT ON TABLE public.basecoat_inventory IS 'Base coat inventory levels (singleton per user)';
COMMENT ON TABLE public.chip_blends IS 'Available chip blend names';
COMMENT ON TABLE public.chip_inventory IS 'Chip inventory by blend';
COMMENT ON TABLE public.coating_inventory IS 'SKU-level coating inventory (part + variant + color), tracked in gallons';
COMMENT ON TABLE public.comm_templates IS 'Reusable communication templates for customer follow-ups';
COMMENT ON TABLE public.costs IS 'Material cost structure (singleton per user)';
COMMENT ON TABLE public.customers IS 'Customer records managed independently from jobs';
COMMENT ON TABLE public.ghl_webhook_events IS 'Raw immutable-ish GHL webhook event ledger with processing status';
COMMENT ON TABLE public.ghl_webhook_sources IS 'Configured GHL webhook sources scoped to a user or organization';
COMMENT ON TABLE public.jobs IS 'Job estimation records with historical snapshots';
COMMENT ON TABLE public.laborers IS 'Labor rates and worker information';
COMMENT ON TABLE public.lead_appointments IS 'Estimate appointment lifecycle records linked to leads';
COMMENT ON TABLE public.leads IS 'Normalized lead attribution and funnel state records';
COMMENT ON TABLE public.misc_inventory IS 'Miscellaneous inventory (crack repair, silica sand, shot)';
COMMENT ON TABLE public.pricing IS 'Pricing configuration for job price calculations';
COMMENT ON TABLE public.pricing_variables IS 'Dynamic pricing variables';
COMMENT ON TABLE public.products IS 'Product catalog for wall storage and non-coating items';
COMMENT ON TABLE public.referral_associates IS 'Third-party contacts who refer work; tagged with one or more services';
COMMENT ON TABLE public.referral_services IS 'Reusable service tags that can be attached to referral associates';
COMMENT ON TABLE public.route_planner_settings IS 'Per-user route planner configuration synced across devices';
COMMENT ON TABLE public.sync_log IS 'Audit trail of sync operations';
COMMENT ON TABLE public.sync_queue IS 'Pending sync operations for offline support';
COMMENT ON TABLE public.systems IS 'Chip system configurations (equipment/product lines)';
COMMENT ON TABLE public.tint_inventory IS 'Tint color inventory tracked in ounces per color';
COMMENT ON TABLE public.topcoat_inventory IS 'Top coat inventory levels (singleton per user)';
COMMENT ON TABLE public.user_preferences IS 'User-specific preferences and settings';

