-- 009_column_sort_by.sql
-- Adds per-column sort preference, shared across all viewers.

ALTER TABLE columns
  ADD COLUMN sort_by TEXT NOT NULL DEFAULT 'votes_desc'
  CHECK (sort_by IN ('votes_desc', 'votes_asc', 'manual'));
