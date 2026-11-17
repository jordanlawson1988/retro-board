-- 014_single_owner_source.sql
-- Ownership is stored in ONE place: boards.owner_id (audit P11, Jordan's call 2026-11-17).
-- board_members.role = 'owner' duplicated it. After this migration board_members holds only
-- facilitator / participant / viewer, and the owner has no board_members row.
--
-- Contents:
--   a) Delete every board_members row whose user is that board's owner (any role).
--   b) Any remaining role = 'owner' row (a user who is NOT boards.owner_id) becomes
--      'facilitator': that is the power such a row actually carried (facilitate, not own).
--      Pre-check on dev and production 2026-11-17: 0 such rows; all 26 owner rows on each
--      are exact duplicates of boards.owner_id, so (a) removes them and nothing else changes.
--   c) Replace board_members_role_check so 'owner' can no longer be stored.
--
-- DEPLOY ORDER: apply AFTER the code that stops writing role = 'owner' is live on the
-- environment. Older code inserts an 'owner' row on every signed-in board creation, which
-- this CHECK rejects. The newer code works on both sides of this migration.
--
-- Requires: 013 (the schema_migrations ledger; checked below).
-- Idempotent: re-running deletes/updates nothing and re-creates the same CHECK.
-- Rollback: restore the old CHECK and re-insert owner rows from boards.owner_id:
--   ALTER TABLE board_members DROP CONSTRAINT board_members_role_check;
--   ALTER TABLE board_members ADD CONSTRAINT board_members_role_check
--     CHECK (role IN ('owner', 'facilitator', 'participant', 'viewer'));
--   INSERT INTO board_members (board_id, user_id, role)
--     SELECT id, owner_id, 'owner' FROM boards WHERE owner_id IS NOT NULL
--     ON CONFLICT (board_id, user_id) DO UPDATE SET role = 'owner';

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF to_regclass('public.schema_migrations') IS NULL THEN
    RAISE EXCEPTION '014 requires 013_participant_uniqueness_and_ledger.sql to be applied first';
  END IF;
END $$;

LOCK TABLE board_members IN SHARE ROW EXCLUSIVE MODE;

DELETE FROM board_members bm
USING boards b
WHERE b.id = bm.board_id AND b.owner_id = bm.user_id;

UPDATE board_members SET role = 'facilitator' WHERE role = 'owner';

ALTER TABLE board_members DROP CONSTRAINT IF EXISTS board_members_role_check;
ALTER TABLE board_members ADD CONSTRAINT board_members_role_check
  CHECK (role IN ('facilitator', 'participant', 'viewer'));

COMMENT ON COLUMN board_members.role IS
  'facilitator > participant > viewer. Ownership is boards.owner_id only; the owner has no row here.';

INSERT INTO schema_migrations (version) VALUES ('014') ON CONFLICT (version) DO NOTHING;

COMMIT;
