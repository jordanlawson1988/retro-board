-- 013_participant_uniqueness_and_ledger.sql
-- From the 2026-11-17 audit (docs/research/2026-11-17-schema-audit.md): F6 / P4
-- (one participant per signed-in user per board) and P10 (migration ledger).
--
-- Contents:
--   a) Merge duplicate participants per (board_id, user_id) where user_id IS NOT NULL.
--      The kept row is the one the app already picks for a signed-in user
--      (is_admin DESC, joined_at ASC), with id ASC as the final tiebreak. Everything
--      that pointed at a removed row is repointed to the kept row:
--        cards.author_id, votes.voter_id, action_items.created_by, boards.created_by,
--        and the ids inside cards.reactions ({ emoji: [participantId, ...] }).
--      votes has UNIQUE (card_id, voter_id): when two rows of one group voted on the
--      same card, one vote survives (the kept row's own, else the oldest) and the
--      others are deleted instead of violating the key.
--   b) Partial unique index uq_participants_board_user on participants (board_id, user_id)
--      WHERE user_id IS NOT NULL. Anonymous participants (user_id NULL) are unaffected.
--   c) schema_migrations(version, applied_at), backfilled for each of 002..012 that the
--      database demonstrably has (detected by an object the migration creates), plus 013.
--
-- Requires: 012_schema_hardening.sql (checked below; aborts if it is missing).
-- Idempotent: with no duplicates left the dedupe touches nothing, the index is
-- IF NOT EXISTS, and ledger inserts are ON CONFLICT DO NOTHING, so re-running is a no-op.
--
-- Locking: one explicit transaction (the runner sends the file as one query call).
-- lock_timeout makes it fail fast rather than queue behind a long transaction.
-- participants is locked SHARE ROW EXCLUSIVE up front (reads continue, writes wait) so
-- no new duplicate can commit between the dedupe and the index build. At the current
-- size (thousands of participants) this lasts milliseconds.
--
-- Side effect: the cards.updated_at trigger fires for cards whose author or
-- reactions are repointed (only cards that referenced a removed participant).
--
-- Rollback: DROP INDEX uq_participants_board_user; DROP TABLE schema_migrations.
-- Merged participant rows cannot be restored (take a Neon branch/restore point first).

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- ---------------------------------------------------------------------------
-- 0. Dependency guard: 012 must be present.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.boards'::regclass AND conname = 'boards_trust_version_check'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.participants'::regclass AND conname = 'uq_participants_id_board_id'
  ) THEN
    RAISE EXCEPTION '013 requires 012_schema_hardening.sql to be applied first';
  END IF;
END $$;

LOCK TABLE participants IN SHARE ROW EXCLUSIVE MODE;

-- ---------------------------------------------------------------------------
-- a) Dedupe participants per (board_id, user_id).
-- _p_dedupe maps every row to remove onto the row to keep. Empty when there is
-- nothing to merge (every later statement then matches zero rows).
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _p_dedupe ON COMMIT DROP AS
SELECT s.id AS removed_id, s.keep_id
FROM (
  SELECT id,
         first_value(id) OVER w AS keep_id,
         row_number()    OVER w AS rn
  FROM participants
  WHERE user_id IS NOT NULL
  WINDOW w AS (PARTITION BY board_id, user_id ORDER BY is_admin DESC, joined_at ASC, id ASC)
) s
WHERE s.rn > 1;

-- The ordering puts admins first, so a removed row can never out-rank the kept one.
-- Assert it rather than silently demote an admin.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM _p_dedupe m
    JOIN participants r ON r.id = m.removed_id
    JOIN participants k ON k.id = m.keep_id
    WHERE r.is_admin AND NOT k.is_admin
  ) THEN
    RAISE EXCEPTION '013: a removed participant is admin but the kept one is not';
  END IF;
END $$;

-- Votes: at most one vote per (card, kept participant) may survive the merge.
-- Prefer the kept row's own vote, then the oldest. Delete the rest first so the
-- repoint below cannot violate UNIQUE (card_id, voter_id).
DELETE FROM votes
USING (
  SELECT v.id,
         row_number() OVER (
           PARTITION BY v.card_id, COALESCE(m.keep_id, v.voter_id)
           ORDER BY (m.removed_id IS NULL) DESC, v.created_at ASC, v.id ASC
         ) AS rn
  FROM votes v
  LEFT JOIN _p_dedupe m ON m.removed_id = v.voter_id
  WHERE v.voter_id IN (SELECT removed_id FROM _p_dedupe UNION SELECT keep_id FROM _p_dedupe)
) d
WHERE votes.id = d.id AND d.rn > 1;

UPDATE votes v SET voter_id = m.keep_id
FROM _p_dedupe m WHERE v.voter_id = m.removed_id;

UPDATE cards c SET author_id = m.keep_id
FROM _p_dedupe m WHERE c.author_id = m.removed_id;

UPDATE action_items a SET created_by = m.keep_id
FROM _p_dedupe m WHERE a.created_by = m.removed_id;

UPDATE boards b SET created_by = m.keep_id
FROM _p_dedupe m WHERE b.created_by = m.removed_id;

-- Reactions: replace removed ids with the kept id and de-duplicate inside each
-- array (first occurrence wins, order preserved). Non-array values are left as-is.
UPDATE cards c
SET reactions = (
  SELECT COALESCE(jsonb_object_agg(e.key,
           CASE WHEN jsonb_typeof(e.value) = 'array' THEN arr.v ELSE e.value END), '{}'::jsonb)
  FROM jsonb_each(c.reactions) e
  CROSS JOIN LATERAL (
    SELECT COALESCE(jsonb_agg(x.val ORDER BY x.first_ord), '[]'::jsonb) AS v
    FROM (
      SELECT COALESCE(m.keep_id, t.val) AS val, min(t.ord) AS first_ord
      FROM jsonb_array_elements_text(
             CASE WHEN jsonb_typeof(e.value) = 'array' THEN e.value ELSE '[]'::jsonb END
           ) WITH ORDINALITY AS t(val, ord)
      LEFT JOIN _p_dedupe m ON m.removed_id = t.val
      GROUP BY COALESCE(m.keep_id, t.val)
    ) x
  ) arr
)
WHERE EXISTS (
  SELECT 1
  FROM jsonb_each(c.reactions) e
  CROSS JOIN LATERAL jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(e.value) = 'array' THEN e.value ELSE '[]'::jsonb END
  ) AS t(val)
  JOIN _p_dedupe m ON m.removed_id = t.val
);

DELETE FROM participants p
USING _p_dedupe m WHERE p.id = m.removed_id;

-- ---------------------------------------------------------------------------
-- b) One participant per signed-in user per board.
-- The join route upserts against this index (ON CONFLICT (board_id, user_id)
-- WHERE user_id IS NOT NULL), so two simultaneous joins yield one row.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_participants_board_user
  ON participants (board_id, user_id) WHERE user_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- c) Migration ledger (P10).
-- scripts/run-one.mjs records each applied file here when this table exists.
-- Backfill only what the database demonstrably has; an undetectable version is
-- never inserted. 010 lives on feature/phase0-billing and is detected by the
-- tables it creates.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    TEXT        PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE schema_migrations IS 'Applied migration files, keyed by numeric prefix (e.g. 013). Written by scripts/run-one.mjs.';

INSERT INTO schema_migrations (version)
SELECT d.version
FROM (VALUES
  ('002', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'boards' AND column_name = 'owner_id')
         AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'participants' AND column_name = 'user_id')),
  ('003', to_regclass('public.board_members') IS NOT NULL
         AND to_regclass('public.board_invites') IS NOT NULL
         AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'boards' AND column_name = 'visibility')),
  ('004', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'boards' AND column_name = 'join_code')),
  ('005', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cards' AND column_name = 'reactions')),
  ('006', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'action_items' AND column_name = 'created_by')),
  ('007', EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public.board_members')
                    AND conname = 'board_members_invited_by_fkey' AND confdeltype = 'n')),
  ('008', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'boards' AND column_name = 'deleted_at')),
  ('009', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'columns' AND column_name = 'sort_by')),
  ('010', to_regclass('public.subscriptions') IS NOT NULL AND to_regclass('public.free_access') IS NOT NULL),
  ('011', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'boards' AND column_name = 'trust_version')),
  ('012', EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.votes'::regclass AND conname = 'votes_card_id_board_id_fkey')
         AND EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.boards'::regclass AND conname = 'boards_trust_version_check')
         AND to_regclass('public.idx_votes_board_id_voter_id') IS NOT NULL)
) AS d(version, present)
WHERE d.present
ON CONFLICT (version) DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('013') ON CONFLICT (version) DO NOTHING;

COMMIT;
