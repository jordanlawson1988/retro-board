-- 008_board_management.sql
-- Soft-delete (Trash) support for boards. Additive + backwards-compatible.
-- A board with deleted_at set is hidden everywhere except the owner's Trash view,
-- and is hard-purged ~30 days later (lazy purge on Trash load).
-- Idempotent (IF NOT EXISTS) so re-running is safe.

ALTER TABLE boards ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Keep active-board listing fast (matches the common `WHERE deleted_at IS NULL`).
CREATE INDEX IF NOT EXISTS idx_boards_deleted_at_null ON boards (id) WHERE deleted_at IS NULL;

-- Trash listing + purge scan.
CREATE INDEX IF NOT EXISTS idx_boards_deleted_at ON boards (deleted_at) WHERE deleted_at IS NOT NULL;

COMMENT ON COLUMN boards.deleted_at IS 'NULL = live; timestamptz when soft-deleted (in Trash). Lazy-purged ~30 days later.';
