-- 012_schema_hardening.sql
-- Schema hardening from the 2026-11-17 audit (docs/research/2026-11-17-schema-audit.md).
--
-- Scope: additive or constraint-tightening only. Every constraint below had ZERO
-- violating rows on the dev branch (a copy of production from 2026-11-16 plus
-- e2e rows) when this was written. No drops, renames, type changes or data rewrites.
--
-- Requires: 011_trust_version.sql (checked below; the file aborts if it is missing).
-- Idempotent: every statement is IF NOT EXISTS or guarded by a catalog check,
-- so re-running is a no-op.
--
-- Locking: the runner (scripts/run-one.mjs) sends this whole file as one query
-- call, which Postgres runs as a single transaction. The explicit BEGIN/COMMIT
-- makes that visible and lets SET LOCAL scope the timeouts to this migration only
-- (the Neon pooler is transaction-mode, so a plain SET could leak to other clients).
-- All of it is atomic: if any statement fails, nothing is applied.
--
-- CREATE INDEX CONCURRENTLY is NOT used: it cannot run inside a transaction block,
-- and a multi-statement query call is always one (verified on dev 2026-11-17:
-- "CREATE INDEX CONCURRENTLY cannot run inside a transaction block"). At the current
-- size (hundreds to low thousands of rows per table) each plain CREATE INDEX /
-- ADD CONSTRAINT holds its lock for milliseconds. Once tables reach roughly 1M+ rows
-- (votes and cards first), run index builds one statement per call with
-- CONCURRENTLY, and add constraints as NOT VALID followed by a separate
-- VALIDATE CONSTRAINT call, so writes are not blocked during the scan.

BEGIN;

-- Fail fast instead of queueing behind a long-running transaction (a queued
-- ACCESS EXCLUSIVE request would block every reader behind it).
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- ---------------------------------------------------------------------------
-- 0. Dependency guard: 011 adds boards.trust_version, which step 1 constrains.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'boards' AND column_name = 'trust_version'
  ) THEN
    RAISE EXCEPTION '012 requires 011_trust_version.sql (boards.trust_version) to be applied first';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. boards.trust_version may only be 1 or 2.
-- lib/board-actor.ts loadBoardActor() throws "Invalid trust_version" for any
-- other value, which turns every request on that board into a 500. Enforce the
-- domain in the database so a bad write fails at write time, not on every read.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.boards'::regclass AND conname = 'boards_trust_version_check'
  ) THEN
    ALTER TABLE boards
      ADD CONSTRAINT boards_trust_version_check CHECK (trust_version IN (1, 2));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. boards.join_code is exactly five digits.
-- lib/join-code.ts generateJoinCode()/isValidJoinCode() define the format and
-- POST /api/boards/join looks boards up by it. Values outside the format can
-- never be typed by a user, so such a board would be unjoinable by code.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.boards'::regclass AND conname = 'boards_join_code_format_check'
  ) THEN
    ALTER TABLE boards
      ADD CONSTRAINT boards_join_code_format_check CHECK (join_code ~ '^[0-9]{5}$');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. JSONB columns that the app spreads as objects must be objects.
-- boards.settings is merged with { ...DEFAULT_BOARD_SETTINGS, ...settings } on
-- every board request (lib/board-actor.ts, app/api/boards/[boardId]/route.ts);
-- an array or scalar would silently corrupt that merge. cards.reactions is read
-- as Record<emoji, participantId[]> by lib/board-guards.ts reactionsChangeOnlyTouches.
-- The API already rejects non-objects (isPlainObject / isReactionsShape), so this
-- only blocks writes that bypass the API.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.boards'::regclass AND conname = 'boards_settings_is_object_check'
  ) THEN
    ALTER TABLE boards
      ADD CONSTRAINT boards_settings_is_object_check CHECK (jsonb_typeof(settings) = 'object');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.cards'::regclass AND conname = 'cards_reactions_is_object_check'
  ) THEN
    ALTER TABLE cards
      ADD CONSTRAINT cards_reactions_is_object_check CHECK (jsonb_typeof(reactions) = 'object');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Same-board referential integrity for the denormalised board_id columns.
--
-- cards, votes and action_items each carry board_id next to a reference to a
-- parent that also has a board_id. Every route authorises by board_id
-- (e.g. "SELECT ... FROM cards WHERE id = $card AND board_id = $board"), so the
-- two must agree. Today only application pre-checks keep them consistent
-- (cards POST/PATCH column check, votes POST card check, action-items POST
-- participant check). Composite foreign keys make the database guarantee it.
--
-- A composite FK needs a unique key on the referenced (id, board_id) pair.
-- id alone is already the primary key, so these are trivially unique; they also
-- serve "WHERE id = $1 AND board_id = $2" lookups as index-only scans.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.columns'::regclass AND conname = 'uq_columns_id_board_id'
  ) THEN
    ALTER TABLE columns ADD CONSTRAINT uq_columns_id_board_id UNIQUE (id, board_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.cards'::regclass AND conname = 'uq_cards_id_board_id'
  ) THEN
    ALTER TABLE cards ADD CONSTRAINT uq_cards_id_board_id UNIQUE (id, board_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.participants'::regclass AND conname = 'uq_participants_id_board_id'
  ) THEN
    ALTER TABLE participants ADD CONSTRAINT uq_participants_id_board_id UNIQUE (id, board_id);
  END IF;
END $$;

-- 4a. A card's column must be on the card's board.
-- Enforces the check in app/api/boards/[boardId]/cards/route.ts POST (line 55)
-- and PATCH column move (line 128). CASCADE matches the existing cards.column_id FK.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.cards'::regclass AND conname = 'cards_column_id_board_id_fkey'
  ) THEN
    ALTER TABLE cards
      ADD CONSTRAINT cards_column_id_board_id_fkey
      FOREIGN KEY (column_id, board_id) REFERENCES columns (id, board_id) ON DELETE CASCADE;
  END IF;
END $$;

-- 4b. A vote's card must be on the vote's board.
-- Enforces the check in app/api/boards/[boardId]/votes/route.ts (line 46);
-- board GET and the vote-limit count both select votes by board_id only.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.votes'::regclass AND conname = 'votes_card_id_board_id_fkey'
  ) THEN
    ALTER TABLE votes
      ADD CONSTRAINT votes_card_id_board_id_fkey
      FOREIGN KEY (card_id, board_id) REFERENCES cards (id, board_id) ON DELETE CASCADE;
  END IF;
END $$;

-- 4c. A card can only be merged into a card on the same board.
-- Enforces the check in cards PATCH (line 132). SET NULL (merged_with) clears
-- only the reference column when the target card is deleted, matching the
-- existing cards_merged_with_fkey; board_id is left untouched (PG 15+ syntax).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.cards'::regclass AND conname = 'cards_merged_with_board_id_fkey'
  ) THEN
    ALTER TABLE cards
      ADD CONSTRAINT cards_merged_with_board_id_fkey
      FOREIGN KEY (merged_with, board_id) REFERENCES cards (id, board_id)
      ON DELETE SET NULL (merged_with);
  END IF;
END $$;

-- 4d. An action item's creator must be a participant on the same board.
-- Enforces the check in app/api/boards/[boardId]/action-items/route.ts POST
-- (line 40); /api/user/stats counts action items by created_by. NULL creators
-- (legacy rows, unjoined facilitators) are not checked (MATCH SIMPLE).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.action_items'::regclass AND conname = 'action_items_created_by_board_id_fkey'
  ) THEN
    ALTER TABLE action_items
      ADD CONSTRAINT action_items_created_by_board_id_fkey
      FOREIGN KEY (created_by, board_id) REFERENCES participants (id, board_id)
      ON DELETE SET NULL (created_by);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. admin_users.id must be a real Better Auth user.
-- admin_users grants system-admin rights (lib/auth-helpers.ts requireSystemAdmin,
-- loadBoardAuthorityFor). Account deletion is enabled (lib/auth.ts
-- user.deleteUser), and without a FK a deleted admin leaves a dangling grant.
-- CASCADE revokes the grant with the account. Better Auth's "user" table itself
-- is not altered.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.admin_users'::regclass AND conname = 'admin_users_id_fkey'
  ) THEN
    ALTER TABLE admin_users
      ADD CONSTRAINT admin_users_id_fkey
      FOREIGN KEY (id) REFERENCES "user" (id) ON DELETE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 6. Index the only unindexed foreign key: board_members.invited_by.
-- Deleting a user runs ON DELETE SET NULL on board_members.invited_by
-- (migration 007), which without an index scans the whole table. Partial,
-- because invited_by is NULL for almost every row.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_board_members_invited_by
  ON board_members (invited_by) WHERE invited_by IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 7. Vote-limit count on every vote cast.
-- app/api/boards/[boardId]/votes/route.ts line 66:
--   SELECT COUNT(*) FROM votes WHERE board_id = $1 AND voter_id = $2
-- Today the planner ANDs two single-column bitmaps (idx_votes_board_id and
-- idx_votes_voter_id). The composite answers it from one index, and its
-- board_id prefix also serves board GET (SELECT * FROM votes WHERE board_id),
-- which makes idx_votes_board_id redundant (drop proposed in the audit, not here).
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_votes_board_id_voter_id
  ON votes (board_id, voter_id);

-- ---------------------------------------------------------------------------
-- 8. Billing tables from 010_billing_paddle.sql.
-- 010 lives on feature/phase0-billing but is applied to both Neon branches.
-- Each step is skipped when the table does not exist, so this file also runs
-- on a database built only from this branch's migrations.
-- ---------------------------------------------------------------------------

-- 8a. free_access.email is documented as "always stored lowercase" and
-- lib/entitlements.ts (billing branch) looks it up with email.toLowerCase().
-- A mixed-case row would silently never match. Table is empty today.
DO $$
BEGIN
  IF to_regclass('public.free_access') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.free_access'::regclass AND conname = 'free_access_email_lowercase_check'
  ) THEN
    ALTER TABLE free_access
      ADD CONSTRAINT free_access_email_lowercase_check CHECK (email = lower(email));
  END IF;
END $$;

-- 8b. subscriptions.updated_at has a now() default but nothing maintains it on
-- UPDATE, unlike cards / feature_flags / app_settings. Reuse the shared trigger
-- function from scripts/migrate.sql.
DO $$
BEGIN
  IF to_regclass('public.subscriptions') IS NOT NULL THEN
    EXECUTE 'CREATE OR REPLACE TRIGGER trg_subscriptions_updated_at
               BEFORE UPDATE ON subscriptions
               FOR EACH ROW
               EXECUTE FUNCTION update_updated_at()';
  END IF;
END $$;

COMMIT;
