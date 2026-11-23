-- 016_group_and_vote.sql
-- Group and vote parity (Parabol parity Step 2): several votes per card on guided
-- boards (votes.count) and an optional title on a card group (cards.group_title).
--
-- Scope: additive only, safe under the currently deployed code. Both columns have
-- safe defaults, so existing INSERTs and SELECTs keep working: a vote inserted
-- without a count gets count = 1, a card without a title has group_title NULL, and
-- every existing row satisfies both checks below.
--
-- The CHECK values must equal MAX_VOTES_PER_CARD_RANGE (lib/constants/board-settings.ts)
-- and GROUP_TITLE_MAX (lib/constants/groups.ts).
-- lib/__tests__/group-vote-migration-contract.test.ts enforces it.
--
-- Requires: 013_participant_uniqueness_and_ledger.sql (schema_migrations), checked
-- below. It does not require 015: these columns are independent of guided mode.
-- Idempotent: columns use IF NOT EXISTS and constraints are guarded by a catalog
-- check, so re-running is a no-op.
--
-- Locking: one explicit transaction (the runner sends the file as a single query
-- call). SET LOCAL scopes the timeouts to this migration. If any statement fails,
-- nothing is applied.
--
-- Rollback: remove the two constraints (votes_count_range, cards_group_title_length),
-- then the two columns (votes.count, cards.group_title), then delete the
-- schema_migrations row for version 016. Only safe while no vote has count > 1.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- ---------------------------------------------------------------------------
-- 0. Dependency guard.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.schema_migrations') IS NULL THEN
    RAISE EXCEPTION '016 requires 013_participant_uniqueness_and_ledger.sql (schema_migrations) to be applied first';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. Columns.
-- ---------------------------------------------------------------------------
ALTER TABLE votes ADD COLUMN IF NOT EXISTS count SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS group_title TEXT;

-- ---------------------------------------------------------------------------
-- 2. Constraints.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.votes'::regclass AND conname = 'votes_count_range'
  ) THEN
    ALTER TABLE votes
      ADD CONSTRAINT votes_count_range CHECK (count BETWEEN 1 AND 12);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.cards'::regclass AND conname = 'cards_group_title_length'
  ) THEN
    ALTER TABLE cards
      ADD CONSTRAINT cards_group_title_length
      CHECK (group_title IS NULL OR char_length(group_title) <= 80);
  END IF;
END $$;

COMMIT;
