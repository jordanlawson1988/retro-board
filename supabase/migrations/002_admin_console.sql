-- 002_admin_console.sql
-- Admin Console: admin_users, feature_flags, app_settings tables
-- Generated: 2026-03-12

-- ============================================================================
-- 1. TABLES
-- ============================================================================

-- Admin users (references Supabase Auth)
CREATE TABLE admin_users (
  id         UUID        PRIMARY KEY REFERENCES auth.users(id),
  email      TEXT        NOT NULL,
  role       TEXT        NOT NULL DEFAULT 'admin' CHECK (role IN ('owner', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE admin_users IS 'Admin console users linked to Supabase Auth accounts';

-- Feature flags
CREATE TABLE feature_flags (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT        NOT NULL UNIQUE,
  name        TEXT        NOT NULL,
  description TEXT,
  is_enabled  BOOLEAN     NOT NULL DEFAULT false,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE feature_flags IS 'Application feature flags toggled via admin console';

-- Auto-update updated_at on feature_flags
CREATE TRIGGER trg_feature_flags_updated_at
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- App-wide settings (singleton enforced by CHECK constraint)
CREATE TABLE app_settings (
  id                     UUID    PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000000'::uuid
                                 CHECK (id = '00000000-0000-0000-0000-000000000000'::uuid),
  default_template       TEXT        NOT NULL DEFAULT 'mad-sad-glad',
  default_board_settings JSONB       NOT NULL DEFAULT '{
    "card_visibility": "hidden",
    "voting_enabled": false,
    "max_votes_per_participant": 5,
    "secret_voting": false,
    "board_locked": false,
    "card_creation_disabled": false,
    "anonymous_cards": false
  }'::jsonb,
  app_name               TEXT        NOT NULL DEFAULT 'RetroBoard',
  app_logo_url           TEXT,
  board_retention_days   INTEGER,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE app_settings IS 'Singleton row for global application settings';

-- Auto-update updated_at on app_settings
CREATE TRIGGER trg_app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 2. ROW LEVEL SECURITY
-- ============================================================================

-- feature_flags: anyone can read, only admins can write
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feature_flags: public read"
  ON feature_flags FOR SELECT USING (true);
CREATE POLICY "feature_flags: admin write"
  ON feature_flags FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT id FROM admin_users));
CREATE POLICY "feature_flags: admin update"
  ON feature_flags FOR UPDATE
  USING (auth.uid() IN (SELECT id FROM admin_users))
  WITH CHECK (auth.uid() IN (SELECT id FROM admin_users));
CREATE POLICY "feature_flags: admin delete"
  ON feature_flags FOR DELETE
  USING (auth.uid() IN (SELECT id FROM admin_users));

-- app_settings: anyone can read, only admins can write
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_settings: public read"
  ON app_settings FOR SELECT USING (true);
CREATE POLICY "app_settings: admin write"
  ON app_settings FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT id FROM admin_users));
CREATE POLICY "app_settings: admin update"
  ON app_settings FOR UPDATE
  USING (auth.uid() IN (SELECT id FROM admin_users))
  WITH CHECK (auth.uid() IN (SELECT id FROM admin_users));

-- admin_users: only admins can read/write (bootstrap first user via service role)
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_users: admin read"
  ON admin_users FOR SELECT
  USING (auth.uid() IN (SELECT id FROM admin_users));
CREATE POLICY "admin_users: admin write"
  ON admin_users FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT id FROM admin_users));
CREATE POLICY "admin_users: admin update"
  ON admin_users FOR UPDATE
  USING (auth.uid() IN (SELECT id FROM admin_users))
  WITH CHECK (auth.uid() IN (SELECT id FROM admin_users));
CREATE POLICY "admin_users: admin delete"
  ON admin_users FOR DELETE
  USING (auth.uid() IN (SELECT id FROM admin_users));

-- ============================================================================
-- 3. SEED DATA
-- ============================================================================

-- Initial feature flag: live_events (enabled by default for backwards compat)
INSERT INTO feature_flags (key, name, description, is_enabled) VALUES
  ('live_events', 'Live Events (Realtime)',
   'Supabase Realtime subscriptions for live card, vote, and participant sync. When disabled, falls back to 10-second polling.',
   true);

-- Initial app settings singleton row
INSERT INTO app_settings (default_template) VALUES ('mad-sad-glad');
