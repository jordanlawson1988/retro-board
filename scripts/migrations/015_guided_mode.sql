-- 015_guided_mode.sql
-- Guided mode (Parabol parity Step 1): a board can step through the phases
-- Reflect, Group, Vote, Discuss, Done.
--
-- Scope: additive only, safe under the currently deployed code. The new columns
-- have defaults ('open' mode, no phase, empty config), so existing boards and
-- existing INSERTs keep working and every existing row satisfies every check below.
-- Adds a 'guided_mode' feature flag row, off by default.
--
-- Vocabularies: the CHECK lists below must equal BOARD_MODES and PHASE_IDS in
-- lib/constants/phases.ts. lib/__tests__/phase-migration-contract.test.ts enforces it.
--
-- Requires: 011_trust_version.sql (boards.trust_version) and 013 (schema_migrations).
-- Both are checked below; the file aborts if either is missing.
-- Idempotent: columns use IF NOT EXISTS, constraints are guarded by a catalog check,
-- and the flag insert is guarded, so re-running is a no-op.
--
-- Locking: one explicit transaction (the runner sends the file as a single query
-- call). SET LOCAL scopes the timeouts to this migration. If any statement fails,
-- nothing is applied.
--
-- Rollback: remove the four boards_* constraints named below, then the three
-- columns (mode, phase, phase_config) from boards, then delete the feature_flags
-- row with key 'guided_mode' and the schema_migrations row for version 015.
-- Only safe while no board has mode = 'guided'.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- ---------------------------------------------------------------------------
-- 0. Dependency guard.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'boards' AND column_name = 'trust_version'
  ) THEN
    RAISE EXCEPTION '015 requires 011_trust_version.sql (boards.trust_version) to be applied first';
  END IF;
  IF to_regclass('public.schema_migrations') IS NULL THEN
    RAISE EXCEPTION '015 requires 013_participant_uniqueness_and_ledger.sql (schema_migrations) to be applied first';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. Columns.
-- ---------------------------------------------------------------------------
ALTER TABLE boards ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'open';
ALTER TABLE boards ADD COLUMN IF NOT EXISTS phase TEXT;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS phase_config JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- 2. Constraints.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.boards'::regclass AND conname = 'boards_mode_check'
  ) THEN
    ALTER TABLE boards
      ADD CONSTRAINT boards_mode_check CHECK (mode IN ('open', 'guided'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.boards'::regclass AND conname = 'boards_phase_check'
  ) THEN
    ALTER TABLE boards
      ADD CONSTRAINT boards_phase_check
      CHECK (phase IS NULL OR phase IN ('reflect', 'group', 'vote', 'discuss', 'done'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.boards'::regclass AND conname = 'boards_phase_matches_mode'
  ) THEN
    ALTER TABLE boards
      ADD CONSTRAINT boards_phase_matches_mode
      CHECK ((mode = 'open' AND phase IS NULL) OR (mode = 'guided' AND phase IS NOT NULL));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.boards'::regclass AND conname = 'boards_guided_needs_v2'
  ) THEN
    ALTER TABLE boards
      ADD CONSTRAINT boards_guided_needs_v2 CHECK (mode = 'open' OR trust_version = 2);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Feature flag row (off by default).
-- ---------------------------------------------------------------------------
INSERT INTO feature_flags (key, name, description, is_enabled)
SELECT 'guided_mode', 'Guided mode', 'Create boards that step through Reflect, Group, Vote and Discuss.', false
WHERE NOT EXISTS (SELECT 1 FROM feature_flags WHERE key = 'guided_mode');

COMMIT;
