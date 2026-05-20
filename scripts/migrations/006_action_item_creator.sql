-- 006_action_item_creator.sql
-- Adds creator attribution to action items so the per-user profile dashboard
-- can count "action items I created". Existing rows get NULL created_by and
-- remain unattributable (historical gap — only items created after this
-- migration are attributed).

ALTER TABLE action_items
  ADD COLUMN IF NOT EXISTS created_by TEXT
  REFERENCES participants (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_action_items_created_by
  ON action_items (created_by);

COMMENT ON COLUMN action_items.created_by IS 'Participant who created the action item (NULL for pre-migration rows)';
