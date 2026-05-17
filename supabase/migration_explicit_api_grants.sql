-- Migration: Add explicit Data API grants for all public tables
-- Required for Supabase's upcoming default change (May 30, 2026)
-- Existing tables keep current implicit grants, but after Oct 30, 2026
-- all projects require explicit grants. Adding them now is a no-op today
-- and future-proofs the schema.

-- =====================================================
-- CORE DATA TABLES (from schema.sql)
-- =====================================================

GRANT SELECT ON public.systems TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.systems TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.systems TO service_role;

GRANT SELECT ON public.pricing_variables TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_variables TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_variables TO service_role;

GRANT SELECT ON public.costs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.costs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.costs TO service_role;

GRANT SELECT ON public.laborers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.laborers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.laborers TO service_role;

GRANT SELECT ON public.chip_blends TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chip_blends TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chip_blends TO service_role;

GRANT SELECT ON public.base_coat_colors TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.base_coat_colors TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.base_coat_colors TO service_role;

GRANT SELECT ON public.jobs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO service_role;

GRANT SELECT ON public.chip_inventory TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chip_inventory TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chip_inventory TO service_role;

GRANT SELECT ON public.topcoat_inventory TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.topcoat_inventory TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.topcoat_inventory TO service_role;

GRANT SELECT ON public.basecoat_inventory TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.basecoat_inventory TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.basecoat_inventory TO service_role;

GRANT SELECT ON public.misc_inventory TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.misc_inventory TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.misc_inventory TO service_role;

GRANT SELECT ON public.sync_queue TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sync_queue TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sync_queue TO service_role;

GRANT SELECT ON public.sync_log TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sync_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sync_log TO service_role;

GRANT SELECT ON public.user_preferences TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences TO service_role;

-- =====================================================
-- TABLES FROM MIGRATIONS
-- =====================================================

GRANT SELECT ON public.pricing TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing TO service_role;

GRANT SELECT ON public.customers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO service_role;

GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO service_role;

GRANT SELECT ON public.tint_inventory TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tint_inventory TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tint_inventory TO service_role;

GRANT SELECT ON public.shopping_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopping_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopping_items TO service_role;

GRANT SELECT ON public.comm_templates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comm_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comm_templates TO service_role;

GRANT SELECT ON public.referral_services TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.referral_services TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.referral_services TO service_role;

GRANT SELECT ON public.referral_associates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.referral_associates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.referral_associates TO service_role;

GRANT SELECT ON public.backups TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backups TO service_role;

-- =====================================================
-- ORGANIZATION TABLES
-- =====================================================

GRANT SELECT ON public.organizations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO service_role;

GRANT SELECT ON public.organization_members TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO service_role;

GRANT SELECT ON public.organization_invitations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_invitations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_invitations TO service_role;

-- =====================================================
-- SEQUENCES (safety net for any serial/identity columns)
-- =====================================================

GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;
