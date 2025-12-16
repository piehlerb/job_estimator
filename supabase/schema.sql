-- Job Estimator Database Schema for Supabase
-- This schema mirrors the IndexedDB structure for cross-device sync
-- All tables include user_id for Row-Level Security (RLS)

-- =====================================================
-- CORE TABLES
-- =====================================================

-- Chip Systems (equipment/product configurations)
CREATE TABLE IF NOT EXISTS systems (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  feet_per_lb NUMERIC NOT NULL,
  box_cost NUMERIC NOT NULL,
  base_spread NUMERIC NOT NULL,
  top_spread NUMERIC NOT NULL,
  cyclo1_spread NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ
);

-- Pricing Variables (dynamic pricing factors)
CREATE TABLE IF NOT EXISTS pricing_variables (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  value NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ
);

-- Material Costs (singleton per user - global cost structure)
CREATE TABLE IF NOT EXISTS costs (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  base_cost_per_gal NUMERIC NOT NULL,
  top_cost_per_gal NUMERIC NOT NULL,
  crack_fill_cost NUMERIC NOT NULL,
  gas_cost NUMERIC NOT NULL,
  consumables_cost NUMERIC NOT NULL,
  cyclo1_cost_per_gal NUMERIC NOT NULL,
  tint_cost_per_quart NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ,
  UNIQUE(user_id) -- Only one costs record per user
);

-- Laborers (worker rates)
CREATE TABLE IF NOT EXISTS laborers (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  fully_loaded_rate NUMERIC NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ
);

-- Chip Blends (available blend names)
CREATE TABLE IF NOT EXISTS chip_blends (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ
);

-- Jobs (main estimation records with snapshots)
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  system_id TEXT NOT NULL,
  floor_footage NUMERIC NOT NULL,
  vertical_footage NUMERIC NOT NULL,
  crack_fill_factor NUMERIC NOT NULL,
  travel_distance NUMERIC NOT NULL,
  install_date TEXT NOT NULL,
  install_days INTEGER NOT NULL,
  job_hours NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  chip_blend TEXT,
  base_color TEXT,
  status TEXT NOT NULL CHECK (status IN ('Won', 'Lost', 'Pending')),
  include_basecoat_tint BOOLEAN,
  include_topcoat_tint BOOLEAN,
  google_drive_folder_id TEXT,

  -- Snapshots stored as JSONB for flexibility
  costs_snapshot JSONB NOT NULL,
  system_snapshot JSONB NOT NULL,
  laborers_snapshot JSONB NOT NULL,

  -- Photos array stored as JSONB
  photos JSONB,

  synced BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ
);

-- =====================================================
-- INVENTORY TABLES (singleton per user)
-- =====================================================

-- Chip Inventory (multiple items by blend)
CREATE TABLE IF NOT EXISTS chip_inventory (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blend TEXT NOT NULL,
  pounds NUMERIC NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ
);

-- Top Coat Inventory (singleton)
CREATE TABLE IF NOT EXISTS topcoat_inventory (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  top_a NUMERIC NOT NULL,
  top_b NUMERIC NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ,
  UNIQUE(user_id) -- Only one record per user
);

-- Base Coat Inventory (singleton)
CREATE TABLE IF NOT EXISTS basecoat_inventory (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  base_a NUMERIC NOT NULL,
  base_b_grey NUMERIC NOT NULL,
  base_b_tan NUMERIC NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ,
  UNIQUE(user_id) -- Only one record per user
);

-- Miscellaneous Inventory (singleton - crack repair, silica sand, shot)
CREATE TABLE IF NOT EXISTS misc_inventory (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  crack_repair NUMERIC NOT NULL,
  silica_sand NUMERIC NOT NULL,
  shot NUMERIC NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ,
  UNIQUE(user_id) -- Only one record per user
);

-- =====================================================
-- SYNC MANAGEMENT
-- =====================================================

-- Sync Queue (tracks pending operations for offline support)
CREATE TABLE IF NOT EXISTS sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('create', 'update', 'delete')),
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  record_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  processed_at TIMESTAMPTZ
);

-- Sync Log (audit trail of sync operations)
CREATE TABLE IF NOT EXISTS sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL CHECK (sync_type IN ('full', 'incremental', 'manual')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  records_pulled INTEGER DEFAULT 0,
  records_pushed INTEGER DEFAULT 0,
  errors JSONB,
  success BOOLEAN
);

-- User Preferences (optional - for future features)
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  auto_sync_enabled BOOLEAN NOT NULL DEFAULT true,
  sync_interval_minutes INTEGER NOT NULL DEFAULT 5,
  theme TEXT DEFAULT 'light',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- User-based queries (most common)
CREATE INDEX IF NOT EXISTS idx_systems_user_id ON systems(user_id);
CREATE INDEX IF NOT EXISTS idx_pricing_variables_user_id ON pricing_variables(user_id);
CREATE INDEX IF NOT EXISTS idx_costs_user_id ON costs(user_id);
CREATE INDEX IF NOT EXISTS idx_laborers_user_id ON laborers(user_id);
CREATE INDEX IF NOT EXISTS idx_chip_blends_user_id ON chip_blends(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_chip_inventory_user_id ON chip_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_topcoat_inventory_user_id ON topcoat_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_basecoat_inventory_user_id ON basecoat_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_misc_inventory_user_id ON misc_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_user_id ON sync_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_user_id ON sync_log(user_id);

-- Sync-based queries
CREATE INDEX IF NOT EXISTS idx_jobs_updated_at ON jobs(updated_at);
CREATE INDEX IF NOT EXISTS idx_jobs_synced ON jobs(synced);
CREATE INDEX IF NOT EXISTS idx_sync_queue_processed ON sync_queue(processed_at) WHERE processed_at IS NULL;

-- Job filters
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_install_date ON jobs(user_id, install_date);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all relevant tables
CREATE TRIGGER update_systems_updated_at BEFORE UPDATE ON systems
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pricing_variables_updated_at BEFORE UPDATE ON pricing_variables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_costs_updated_at BEFORE UPDATE ON costs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_laborers_updated_at BEFORE UPDATE ON laborers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chip_blends_updated_at BEFORE UPDATE ON chip_blends
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chip_inventory_updated_at BEFORE UPDATE ON chip_inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_topcoat_inventory_updated_at BEFORE UPDATE ON topcoat_inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_basecoat_inventory_updated_at BEFORE UPDATE ON basecoat_inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_misc_inventory_updated_at BEFORE UPDATE ON misc_inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE systems IS 'Chip system configurations (equipment/product lines)';
COMMENT ON TABLE pricing_variables IS 'Dynamic pricing variables';
COMMENT ON TABLE costs IS 'Material cost structure (singleton per user)';
COMMENT ON TABLE laborers IS 'Labor rates and worker information';
COMMENT ON TABLE chip_blends IS 'Available chip blend names';
COMMENT ON TABLE jobs IS 'Job estimation records with historical snapshots';
COMMENT ON TABLE chip_inventory IS 'Chip inventory by blend';
COMMENT ON TABLE topcoat_inventory IS 'Top coat inventory levels (singleton per user)';
COMMENT ON TABLE basecoat_inventory IS 'Base coat inventory levels (singleton per user)';
COMMENT ON TABLE misc_inventory IS 'Miscellaneous inventory (crack repair, silica sand, shot)';
COMMENT ON TABLE sync_queue IS 'Pending sync operations for offline support';
COMMENT ON TABLE sync_log IS 'Audit trail of sync operations';
COMMENT ON TABLE user_preferences IS 'User-specific preferences and settings';
