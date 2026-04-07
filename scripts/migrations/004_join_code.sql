-- 004_join_code.sql
-- Add a 5-digit join code to boards for easy sharing

ALTER TABLE boards ADD COLUMN join_code TEXT;

-- Generate codes for existing boards
UPDATE boards SET join_code = LPAD(FLOOR(RANDOM() * 100000)::TEXT, 5, '0');

-- Now make it NOT NULL and UNIQUE
ALTER TABLE boards ALTER COLUMN join_code SET NOT NULL;
ALTER TABLE boards ADD CONSTRAINT uq_boards_join_code UNIQUE (join_code);

CREATE INDEX idx_boards_join_code ON boards (join_code);

COMMENT ON COLUMN boards.join_code IS '5-digit code for easy board sharing (e.g. 48291)';
