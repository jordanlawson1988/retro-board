import { sql } from '@/lib/db';
import { decideBoardAccess, type BoardAccessDecision } from '@/lib/board-access';

export interface LoadBoardAccessInput {
  boardId: string;
  trustVersion: 1 | 2;
  archived: boolean;
  userId: string | null;
  /** v2: the participant resolved from the signed cookie (already checked to exist), else null. */
  cookieParticipantId: string | null;
  /** v1 only: the participant id the client claims. Ignored on v2. */
  claimedParticipantId: string | null;
}

/** Gather the caller's standing on a board and run the shared decision. */
export async function loadBoardAccess(i: LoadBoardAccessInput): Promise<BoardAccessDecision> {
  let hasParticipantRow = false;
  if (i.trustVersion === 2) {
    hasParticipantRow = i.cookieParticipantId !== null;
  } else if (i.claimedParticipantId) {
    const [r] = await sql`
      SELECT 1 AS ok FROM participants WHERE id = ${i.claimedParticipantId} AND board_id = ${i.boardId}
    `;
    hasParticipantRow = !!r;
  }

  let userMatchedParticipant = false;
  let userIsOwner = false;
  let userIsMember = false;
  let userIsSystemAdmin = false;
  if (i.userId) {
    const [r] = await sql`
      SELECT
        EXISTS (SELECT 1 FROM participants WHERE board_id = ${i.boardId} AND user_id = ${i.userId}) AS matched,
        EXISTS (SELECT 1 FROM boards WHERE id = ${i.boardId} AND owner_id = ${i.userId})             AS is_owner,
        EXISTS (SELECT 1 FROM board_members WHERE board_id = ${i.boardId} AND user_id = ${i.userId}) AS is_member,
        EXISTS (SELECT 1 FROM admin_users WHERE id = ${i.userId})                                    AS is_admin
    `;
    userMatchedParticipant = !!r?.matched;
    userIsOwner = !!r?.is_owner;
    userIsMember = !!r?.is_member;
    userIsSystemAdmin = !!r?.is_admin;
  }

  return decideBoardAccess({
    archived: i.archived,
    hasParticipantRow,
    userMatchedParticipant,
    userIsOwner,
    userIsMember,
    userIsSystemAdmin,
  });
}
