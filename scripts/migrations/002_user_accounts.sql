-- 002_user_accounts.sql
-- Adds user ownership to boards and optional user linking for participants.
-- Better Auth auto-creates: user, session, account, verification tables.
-- This migration adds columns that reference the Better Auth `user` table.

-- Add owner_id to boards (nullable for backwards compat with existing boards)
ALTER TABLE boards ADD COLUMN owner_id TEXT REFERENCES "user"(id) ON DELETE SET NULL;

-- Add user_id to participants (nullable — anonymous participants have no user)
ALTER TABLE participants ADD COLUMN user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL;

-- Index for dashboard queries: "show me all boards I own"
CREATE INDEX idx_boards_owner_id ON boards (owner_id) WHERE owner_id IS NOT NULL;

-- Index for "show me boards where I'm a participant"
CREATE INDEX idx_participants_user_id ON participants (user_id) WHERE user_id IS NOT NULL;

COMMENT ON COLUMN boards.owner_id IS 'Better Auth user ID of the board creator (NULL for anonymous/legacy boards)';
COMMENT ON COLUMN participants.user_id IS 'Better Auth user ID if participant is logged in (NULL for anonymous)';
