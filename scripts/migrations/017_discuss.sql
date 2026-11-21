-- 017_discuss.sql
-- Guided Discuss phase (Parabol parity Step 3): comment threads on topics (a topic
-- is a card or group lead) and action items linked to a topic and to an assignee.
--
-- Scope: additive only, safe under the currently deployed code. A new table nothing
-- reads yet and two nullable columns: existing INSERTs name their columns, and
-- existing SELECT * reads gain two null keys.
--
-- The body CHECK must equal COMMENT_BODY_MAX (lib/constants/comments.ts).
-- lib/__tests__/discuss-migration-contract.test.ts enforces it.
--
-- Requires: 012_schema_hardening.sql (uq_cards_id_board_id, uq_participants_id_board_id)
-- and 013_participant_uniqueness_and_ledger.sql (schema_migrations), both checked
-- below. It does not require 015 or 016.
-- Idempotent: the table and indexes use IF NOT EXISTS, columns use IF NOT EXISTS,
-- and the two action_items constraints are guarded by a catalog check, so
-- re-running is a no-op.
--
-- Locking: one explicit transaction (the runner sends the file as a single query
-- call). SET LOCAL scopes the timeouts to this migration. If any statement fails,
-- nothing is applied.
--
-- Rollback: remove the table comments, then the two action_items constraints
-- (action_items_card_id_board_id_fkey, action_items_assignee_board_id_fkey) and the
-- index idx_action_items_card_id, then the two columns (card_id,
-- assignee_participant_id) from action_items, then delete the schema_migrations row
-- for version 017. Only safe while no action item has a card_id or
-- assignee_participant_id that matters.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- ---------------------------------------------------------------------------
-- 0. Dependency guard.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.schema_migrations') IS NULL THEN
    RAISE EXCEPTION '017 requires 013_participant_uniqueness_and_ledger.sql (schema_migrations) to be applied first';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.cards'::regclass AND conname = 'uq_cards_id_board_id')
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.participants'::regclass AND conname = 'uq_participants_id_board_id') THEN
    RAISE EXCEPTION '017 requires 012_schema_hardening.sql (uq_cards_id_board_id, uq_participants_id_board_id) to be applied first';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. Comments. A comment goes with its card (CASCADE, like votes) and a reply goes
-- with its parent. An author leaving keeps the comment and its stored author_name.
-- A deleted comment keeps its row (so replies stay in view) with an empty body.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comments (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id              TEXT        NOT NULL REFERENCES boards (id) ON DELETE CASCADE,
  card_id               TEXT        NOT NULL,
  parent_id             UUID,
  author_participant_id TEXT,
  author_name           TEXT        NOT NULL,
  is_anonymous          BOOLEAN     NOT NULL DEFAULT false,
  body                  TEXT        NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at             TIMESTAMPTZ,
  deleted_at            TIMESTAMPTZ,
  CONSTRAINT uq_comments_id_card_id UNIQUE (id, card_id),
  CONSTRAINT comments_card_id_board_id_fkey
    FOREIGN KEY (card_id, board_id) REFERENCES cards (id, board_id) ON DELETE CASCADE,
  CONSTRAINT comments_parent_same_card_fkey
    FOREIGN KEY (parent_id, card_id) REFERENCES comments (id, card_id) ON DELETE CASCADE,
  CONSTRAINT comments_author_board_fkey
    FOREIGN KEY (author_participant_id, board_id) REFERENCES participants (id, board_id)
    ON DELETE SET NULL (author_participant_id),
  CONSTRAINT comments_not_own_parent CHECK (parent_id IS NULL OR parent_id <> id),
  CONSTRAINT comments_body_length CHECK (
    (deleted_at IS NULL AND char_length(body) BETWEEN 1 AND 1000)
    OR (deleted_at IS NOT NULL AND body = '')
  )
);

CREATE INDEX IF NOT EXISTS idx_comments_board_id_created_at ON comments (board_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments (parent_id) WHERE parent_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Action items linked to a topic and to an assignee (both optional).
-- ---------------------------------------------------------------------------
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS card_id TEXT;
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS assignee_participant_id TEXT;

-- An action item never goes with a card or a person: only the reference column is
-- cleared and board_id stays (PG 15+ syntax, as 012 4c and 4d use). The owner's
-- name stays in the existing assignee column.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.action_items'::regclass AND conname = 'action_items_card_id_board_id_fkey'
  ) THEN
    ALTER TABLE action_items
      ADD CONSTRAINT action_items_card_id_board_id_fkey
      FOREIGN KEY (card_id, board_id) REFERENCES cards (id, board_id)
      ON DELETE SET NULL (card_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.action_items'::regclass AND conname = 'action_items_assignee_board_id_fkey'
  ) THEN
    ALTER TABLE action_items
      ADD CONSTRAINT action_items_assignee_board_id_fkey
      FOREIGN KEY (assignee_participant_id, board_id) REFERENCES participants (id, board_id)
      ON DELETE SET NULL (assignee_participant_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_action_items_card_id ON action_items (card_id) WHERE card_id IS NOT NULL;

COMMIT;
