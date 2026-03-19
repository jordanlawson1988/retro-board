-- migrate.sql
-- RetroBoard: Combined Neon (serverless Postgres) migration
-- Generated: 2026-03-19
--
-- This file combines 001_initial_schema.sql and 002_admin_console.sql from the
-- original Supabase setup, with the following Supabase-specific features removed:
--   - Row Level Security (ALTER TABLE ... ENABLE ROW LEVEL SECURITY)
--   - RLS policies (CREATE POLICY ...)
--   - Realtime publication (ALTER PUBLICATION supabase_realtime ...)
--   - Supabase Auth references (auth.users, auth.uid())
--
-- Authorization is handled entirely by Next.js API routes + Better Auth.
-- Admin identity is verified server-side; no RLS is needed.


-- ============================================================================
-- PART 1: CORE TABLES (from 001_initial_schema.sql)
-- ============================================================================

-- -------------------------------------------------
-- boards
-- Grain: One row per retrospective board.
-- The id is a short nanoid used in shareable URLs (e.g. /board/V1StGXR8_Z5jdHi6B-myT).
-- -------------------------------------------------
CREATE TABLE boards (
  id          TEXT        PRIMARY KEY,              -- nanoid, used in shareable URLs
  title       TEXT        NOT NULL,
  description TEXT,
  template    TEXT        NOT NULL
                          CHECK (template IN (
                            'mad-sad-glad',
                            'liked-learned-lacked',
                            'start-stop-continue',
                            'went-well-didnt-action',
                            'custom'
                          )),
  created_by  TEXT        NOT NULL,                 -- participant id of the board creator
  settings    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ                           -- NULL = active; set when archived
);

COMMENT ON TABLE  boards              IS 'One row per retrospective board';
COMMENT ON COLUMN boards.id           IS 'Short nanoid for shareable URLs';
COMMENT ON COLUMN boards.template     IS 'Board template: mad-sad-glad | liked-learned-lacked | start-stop-continue | went-well-didnt-action | custom';
COMMENT ON COLUMN boards.created_by   IS 'Participant id of the admin/creator';
COMMENT ON COLUMN boards.settings     IS 'Flexible JSONB: card_visibility, voting config, timer state, etc.';
COMMENT ON COLUMN boards.archived_at  IS 'NULL means active; timestamptz when archived';

-- -------------------------------------------------
-- columns
-- Grain: One row per column on a board.
-- Columns define the categories (e.g. "Mad", "Sad", "Glad").
-- -------------------------------------------------
CREATE TABLE columns (
  id          TEXT        PRIMARY KEY,              -- nanoid
  board_id    TEXT        NOT NULL REFERENCES boards (id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  description TEXT,
  color       TEXT        NOT NULL DEFAULT '#004F71',
  position    INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  columns            IS 'One row per column on a board';
COMMENT ON COLUMN columns.position   IS 'Sort order within the board (0-based)';
COMMENT ON COLUMN columns.color      IS 'Hex color for the column header';

-- -------------------------------------------------
-- participants
-- Grain: One row per person who joins a board.
-- Created BEFORE cards/votes because those tables reference participant ids.
-- Participants join without auth — id is a client-generated UUID string.
-- -------------------------------------------------
CREATE TABLE participants (
  id           TEXT        PRIMARY KEY,             -- client-generated UUID string
  board_id     TEXT        NOT NULL REFERENCES boards (id) ON DELETE CASCADE,
  display_name TEXT        NOT NULL,
  is_admin     BOOLEAN     NOT NULL DEFAULT false,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  participants              IS 'One row per person who joins a board';
COMMENT ON COLUMN participants.id           IS 'Client-generated UUID string (no auth required)';
COMMENT ON COLUMN participants.is_admin     IS 'True for the board creator; false for regular participants';
COMMENT ON COLUMN participants.last_seen    IS 'Updated on each interaction for presence tracking';

-- -------------------------------------------------
-- cards
-- Grain: One row per sticky note card on a board.
-- -------------------------------------------------
CREATE TABLE cards (
  id          TEXT        PRIMARY KEY,              -- nanoid
  column_id   TEXT        NOT NULL REFERENCES columns (id) ON DELETE CASCADE,
  board_id    TEXT        NOT NULL REFERENCES boards (id) ON DELETE CASCADE,
  text        TEXT        NOT NULL DEFAULT '',
  author_name TEXT        NOT NULL,
  author_id   TEXT        NOT NULL,                 -- participant id
  color       TEXT,
  position    INTEGER     NOT NULL DEFAULT 0,
  merged_with TEXT        REFERENCES cards (id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  cards              IS 'One row per sticky note card on a board';
COMMENT ON COLUMN cards.author_id    IS 'References participants.id (the card creator)';
COMMENT ON COLUMN cards.merged_with  IS 'If set, this card has been merged/grouped with another card';
COMMENT ON COLUMN cards.position     IS 'Sort order within the column (0-based)';

-- -------------------------------------------------
-- votes
-- Grain: One row per vote on a card.
-- The UNIQUE constraint on (card_id, voter_id) prevents double-voting.
-- -------------------------------------------------
CREATE TABLE votes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id     TEXT        NOT NULL REFERENCES cards (id) ON DELETE CASCADE,
  board_id    TEXT        NOT NULL REFERENCES boards (id) ON DELETE CASCADE,
  voter_id    TEXT        NOT NULL,                 -- participant id
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_votes_card_voter UNIQUE (card_id, voter_id)
);

COMMENT ON TABLE  votes            IS 'One row per vote on a card';
COMMENT ON COLUMN votes.voter_id   IS 'References participants.id (the voter)';

-- -------------------------------------------------
-- action_items
-- Grain: One row per action item created from a retrospective.
-- -------------------------------------------------
CREATE TABLE action_items (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id    TEXT        NOT NULL REFERENCES boards (id) ON DELETE CASCADE,
  description TEXT        NOT NULL,
  assignee    TEXT,                                  -- free-text assignee name
  due_date    DATE,
  status      TEXT        NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open', 'in_progress', 'done')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  action_items          IS 'One row per action item from a retrospective';
COMMENT ON COLUMN action_items.status   IS 'Workflow state: open -> in_progress -> done';
COMMENT ON COLUMN action_items.assignee IS 'Free-text assignee name (not a FK)';


-- ============================================================================
-- PART 2: CORE INDEXES
-- ============================================================================

-- boards
CREATE INDEX idx_boards_created_by   ON boards (created_by);
CREATE INDEX idx_boards_created_at   ON boards (created_at DESC);
CREATE INDEX idx_boards_archived_at  ON boards (archived_at)
  WHERE archived_at IS NULL;          -- partial index: quickly find active boards

-- columns
CREATE INDEX idx_columns_board_id    ON columns (board_id);
CREATE INDEX idx_columns_ordering    ON columns (board_id, position);

-- participants
CREATE INDEX idx_participants_board_id ON participants (board_id);

-- cards
CREATE INDEX idx_cards_column_id     ON cards (column_id);
CREATE INDEX idx_cards_board_id      ON cards (board_id);
CREATE INDEX idx_cards_author_id     ON cards (author_id);
CREATE INDEX idx_cards_ordering      ON cards (column_id, position);
CREATE INDEX idx_cards_merged_with   ON cards (merged_with)
  WHERE merged_with IS NOT NULL;      -- partial: only index rows that are merged

-- votes
CREATE INDEX idx_votes_card_id       ON votes (card_id);
CREATE INDEX idx_votes_board_id      ON votes (board_id);
CREATE INDEX idx_votes_voter_id      ON votes (voter_id);
-- Note: the UNIQUE constraint on (card_id, voter_id) already creates a composite index

-- action_items
CREATE INDEX idx_action_items_board_id ON action_items (board_id);
CREATE INDEX idx_action_items_status   ON action_items (board_id, status);


-- ============================================================================
-- PART 3: TRIGGERS (auto-update updated_at)
-- ============================================================================

-- Reusable trigger function — attach to any table with an updated_at column
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach to cards table
CREATE TRIGGER trg_cards_updated_at
  BEFORE UPDATE ON cards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();


-- ============================================================================
-- PART 4: ADMIN TABLES (from 002_admin_console.sql)
-- ============================================================================

-- -------------------------------------------------
-- admin_users
-- Better Auth uses TEXT ids (not UUID), so id is TEXT PRIMARY KEY.
-- No foreign key to auth.users — identity is verified via Better Auth sessions.
-- -------------------------------------------------
CREATE TABLE admin_users (
  id         TEXT        PRIMARY KEY,
  email      TEXT        NOT NULL,
  role       TEXT        NOT NULL DEFAULT 'admin' CHECK (role IN ('owner', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE admin_users IS 'Admin console users linked to Better Auth accounts';

-- -------------------------------------------------
-- feature_flags
-- -------------------------------------------------
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

-- -------------------------------------------------
-- app_settings
-- Singleton enforced by CHECK constraint on id.
-- -------------------------------------------------
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
-- PART 5: SEED DATA
-- ============================================================================

-- Initial feature flag: live_events (enabled by default for backwards compat)
INSERT INTO feature_flags (key, name, description, is_enabled) VALUES
  ('live_events', 'Live Events (Realtime)',
   'Ably Realtime subscriptions for live card, vote, and participant sync. When disabled, falls back to 10-second polling.',
   true);

-- Initial app settings singleton row
INSERT INTO app_settings (default_template) VALUES ('mad-sad-glad');
