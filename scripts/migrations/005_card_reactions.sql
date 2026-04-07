-- 005_card_reactions.sql
-- Add emoji reactions to cards
-- Format: { "👍": ["participantId1", "participantId2"], "❤️": ["participantId3"] }

ALTER TABLE cards ADD COLUMN IF NOT EXISTS reactions JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN cards.reactions IS 'Emoji reactions map: { emoji: [participantId, ...] }';
