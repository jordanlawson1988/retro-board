-- 011: trust model version per board (Parabol parity Step 0).
-- Additive and safe under the currently deployed code.
ALTER TABLE boards ADD COLUMN IF NOT EXISTS trust_version SMALLINT NOT NULL DEFAULT 1;
COMMENT ON COLUMN boards.trust_version IS '1 = legacy client-trusted identity; 2 = signed participant sessions and shaped payloads';
