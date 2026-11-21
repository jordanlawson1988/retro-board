-- 018_wrap_up.sql
-- Wrap-up (Parabol parity Step 4): the tables behind the guided summary email, and
-- the summary_email feature flag row.
--
-- Scope: additive only, safe under the currently deployed code. Three new tables
-- nothing reads until the summary_email flag is on, and one flag row, off.
-- email_preferences holds a person's opt-out, summary_email_sends records one send
-- per board, completion and person, and email_outbox holds messages recorded
-- instead of sent when the outbox transport is used.
--
-- The CHECK lists must equal SUMMARY_SEND_STATUSES and EMAIL_KINDS, and the error
-- length must equal SEND_ERROR_MAX (lib/constants/email.ts).
-- lib/__tests__/wrap-up-migration-contract.test.ts enforces it.
--
-- Requires: 013_participant_uniqueness_and_ledger.sql (schema_migrations) and Better
-- Auth's "user" table with its "emailVerified" column, both checked below. It does
-- not require 015 to 017: the feature that uses these tables needs them, the schema
-- does not.
-- Idempotent: tables and the index use IF NOT EXISTS and the flag row is inserted
-- only when absent, so re-running is a no-op. No column is added to Better Auth's
-- tables.
--
-- Locking: one explicit transaction (the runner sends the file as a single query
-- call). The foreign keys take brief SHARE ROW EXCLUSIVE locks on "user" and boards,
-- bounded by lock_timeout, so it is safe to retry. SET LOCAL scopes the timeouts to
-- this migration. If any statement fails, nothing is applied.
--
-- Rollback: remove the tables email_outbox, summary_email_sends and
-- email_preferences, delete the feature_flags row for key summary_email, then delete
-- the schema_migrations row for version 018. Only safe while the flag has never
-- been on.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- ---------------------------------------------------------------------------
-- 0. Dependency guard.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.schema_migrations') IS NULL THEN
    RAISE EXCEPTION '018 requires 013_participant_uniqueness_and_ledger.sql (schema_migrations) to be applied first';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user' AND column_name = 'emailVerified'
  ) THEN
    RAISE EXCEPTION '018 requires the Better Auth "user" table with its "emailVerified" column';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. Email preferences. One row per account that changed a setting; no row means
-- the default (on). Goes with the account.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_preferences (
  user_id       TEXT        PRIMARY KEY REFERENCES "user" (id) ON DELETE CASCADE,
  summary_email BOOLEAN     NOT NULL DEFAULT true,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 2. Summary email sends. The primary key makes a send once per board, completion
-- and person. Goes with the account and with the board.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS summary_email_sends (
  board_id     TEXT        NOT NULL REFERENCES boards (id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL,
  user_id      TEXT        NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  status       TEXT        NOT NULL DEFAULT 'pending',
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at  TIMESTAMPTZ,
  CONSTRAINT summary_email_sends_pkey PRIMARY KEY (board_id, completed_at, user_id),
  CONSTRAINT summary_email_sends_status_check CHECK (status IN ('pending', 'sent', 'recorded', 'failed')),
  CONSTRAINT summary_email_sends_error_length CHECK (error IS NULL OR char_length(error) <= 500)
);

-- ---------------------------------------------------------------------------
-- 3. Email outbox. Messages recorded instead of sent. Goes with the board.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_outbox (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  kind       TEXT        NOT NULL,
  board_id   TEXT        REFERENCES boards (id) ON DELETE CASCADE,
  batch_key  TEXT        NOT NULL,
  to_address TEXT        NOT NULL,
  subject    TEXT        NOT NULL,
  text_body  TEXT        NOT NULL,
  html_body  TEXT        NOT NULL,
  headers    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT email_outbox_kind_check CHECK (kind IN ('summary'))
);

CREATE INDEX IF NOT EXISTS idx_email_outbox_board_id ON email_outbox (board_id);

-- ---------------------------------------------------------------------------
-- 4. Feature flag row (off by default).
-- ---------------------------------------------------------------------------
INSERT INTO feature_flags (key, name, description, is_enabled)
SELECT 'summary_email', 'Summary email', 'Email a short summary to signed-in people when a guided retro is completed.', false
WHERE NOT EXISTS (SELECT 1 FROM feature_flags WHERE key = 'summary_email');

COMMIT;
