-- 007_invited_by_on_delete.sql
-- board_members.invited_by had no ON DELETE rule (defaults to NO ACTION),
-- which would block deleting a user who invited others. Switch to SET NULL
-- so account deletion succeeds and the invite reference is simply cleared.

ALTER TABLE board_members DROP CONSTRAINT IF EXISTS board_members_invited_by_fkey;
ALTER TABLE board_members
  ADD CONSTRAINT board_members_invited_by_fkey
  FOREIGN KEY (invited_by) REFERENCES "user"(id) ON DELETE SET NULL;
