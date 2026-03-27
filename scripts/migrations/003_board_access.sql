-- 003_board_access.sql
-- Board membership and invite system for access control.

-- Add visibility setting to boards
ALTER TABLE boards ADD COLUMN visibility TEXT NOT NULL DEFAULT 'link'
  CHECK (visibility IN ('link', 'invite_only'));

-- Board members: tracks which authenticated users have explicit access
CREATE TABLE board_members (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id   TEXT        NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id    TEXT        NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  role       TEXT        NOT NULL DEFAULT 'participant'
                         CHECK (role IN ('owner', 'facilitator', 'participant', 'viewer')),
  invited_by TEXT        REFERENCES "user"(id),
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(board_id, user_id)
);

COMMENT ON TABLE board_members IS 'Authenticated users with explicit board access';
COMMENT ON COLUMN board_members.role IS 'Access level: owner > facilitator > participant > viewer';

CREATE INDEX idx_board_members_board_id ON board_members (board_id);
CREATE INDEX idx_board_members_user_id ON board_members (user_id);

-- Board invites: email-based invite tokens
CREATE TABLE board_invites (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id    TEXT        NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL,
  role        TEXT        NOT NULL DEFAULT 'participant'
                          CHECK (role IN ('facilitator', 'participant', 'viewer')),
  token       TEXT        NOT NULL UNIQUE,
  accepted_at TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE board_invites IS 'Email-based board invitations with expiring tokens';

CREATE INDEX idx_board_invites_board_id ON board_invites (board_id);
CREATE INDEX idx_board_invites_token ON board_invites (token);

COMMENT ON COLUMN boards.visibility IS 'link = anyone with URL can join; invite_only = requires board_members entry or valid invite';
