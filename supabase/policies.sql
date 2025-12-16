-- Row-Level Security (RLS) Policies
-- Ensures users can only access their own data
-- Must be run AFTER schema.sql

-- =====================================================
-- ENABLE RLS ON ALL TABLES
-- =====================================================

ALTER TABLE systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE laborers ENABLE ROW LEVEL SECURITY;
ALTER TABLE chip_blends ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE chip_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE topcoat_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE basecoat_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE misc_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLICY HELPER FUNCTION
-- =====================================================

-- Note: Supabase provides auth.uid() function by default
-- We'll use that instead of creating our own

-- =====================================================
-- SYSTEMS TABLE POLICIES
-- =====================================================

-- Users can view their own systems
CREATE POLICY "Users can view own systems"
  ON systems FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own systems
CREATE POLICY "Users can insert own systems"
  ON systems FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own systems
CREATE POLICY "Users can update own systems"
  ON systems FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own systems
CREATE POLICY "Users can delete own systems"
  ON systems FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- PRICING VARIABLES TABLE POLICIES
-- =====================================================

CREATE POLICY "Users can view own pricing variables"
  ON pricing_variables FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pricing variables"
  ON pricing_variables FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pricing variables"
  ON pricing_variables FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own pricing variables"
  ON pricing_variables FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- COSTS TABLE POLICIES
-- =====================================================

CREATE POLICY "Users can view own costs"
  ON costs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own costs"
  ON costs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own costs"
  ON costs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own costs"
  ON costs FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- LABORERS TABLE POLICIES
-- =====================================================

CREATE POLICY "Users can view own laborers"
  ON laborers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own laborers"
  ON laborers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own laborers"
  ON laborers FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own laborers"
  ON laborers FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- CHIP BLENDS TABLE POLICIES
-- =====================================================

CREATE POLICY "Users can view own chip blends"
  ON chip_blends FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chip blends"
  ON chip_blends FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chip blends"
  ON chip_blends FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own chip blends"
  ON chip_blends FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- JOBS TABLE POLICIES
-- =====================================================

CREATE POLICY "Users can view own jobs"
  ON jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own jobs"
  ON jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own jobs"
  ON jobs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own jobs"
  ON jobs FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- CHIP INVENTORY TABLE POLICIES
-- =====================================================

CREATE POLICY "Users can view own chip inventory"
  ON chip_inventory FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chip inventory"
  ON chip_inventory FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chip inventory"
  ON chip_inventory FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own chip inventory"
  ON chip_inventory FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- TOPCOAT INVENTORY TABLE POLICIES
-- =====================================================

CREATE POLICY "Users can view own topcoat inventory"
  ON topcoat_inventory FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own topcoat inventory"
  ON topcoat_inventory FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own topcoat inventory"
  ON topcoat_inventory FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own topcoat inventory"
  ON topcoat_inventory FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- BASECOAT INVENTORY TABLE POLICIES
-- =====================================================

CREATE POLICY "Users can view own basecoat inventory"
  ON basecoat_inventory FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own basecoat inventory"
  ON basecoat_inventory FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own basecoat inventory"
  ON basecoat_inventory FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own basecoat inventory"
  ON basecoat_inventory FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- MISC INVENTORY TABLE POLICIES
-- =====================================================

CREATE POLICY "Users can view own misc inventory"
  ON misc_inventory FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own misc inventory"
  ON misc_inventory FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own misc inventory"
  ON misc_inventory FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own misc inventory"
  ON misc_inventory FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- SYNC QUEUE TABLE POLICIES
-- =====================================================

CREATE POLICY "Users can view own sync queue"
  ON sync_queue FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sync queue"
  ON sync_queue FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sync queue"
  ON sync_queue FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sync queue"
  ON sync_queue FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- SYNC LOG TABLE POLICIES
-- =====================================================

CREATE POLICY "Users can view own sync log"
  ON sync_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sync log"
  ON sync_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Note: Sync logs are append-only, no update/delete policies

-- =====================================================
-- USER PREFERENCES TABLE POLICIES
-- =====================================================

CREATE POLICY "Users can view own preferences"
  ON user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON user_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own preferences"
  ON user_preferences FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- VERIFY RLS IS ENABLED
-- =====================================================

-- Query to verify all tables have RLS enabled
-- Run this to check status:
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
