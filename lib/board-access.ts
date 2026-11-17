import { BOARD_ACCESS, type BoardAccess } from '@/lib/constants/board-access';

/**
 * Who counts as "part of" a board. The one place the rule lives: the board GET, the join
 * route, the join-by-code route and the Ably token route all call `decideBoardAccess`, so
 * they cannot drift.
 *
 * Identity limits: `hasParticipantRow` is proven on v2 (signed cookie, row exists on this
 * board). On legacy v1 boards it is only the id the client CLAIMED (query/body) and checked
 * against the participants table, so on v1 anyone who knows a participant id can pass as that
 * participant. That is the existing v1 trust model and is not made worse here. The user_*
 * fields come from the signed-in Better Auth session and are provable on both versions.
 */
export interface BoardAccessInput {
  archived: boolean;
  /** A participants row exists on this board for the caller's identity (v2 cookie / v1 claimed id). */
  hasParticipantRow: boolean;
  /** The signed-in user has a participants.user_id row on this board. */
  userMatchedParticipant: boolean;
  userIsOwner: boolean;
  /** Any board_members row (facilitator, participant or viewer). The owner is userIsOwner. */
  userIsMember: boolean;
  userIsSystemAdmin: boolean;
}

export interface BoardAccessDecision {
  access: BoardAccess;
  /** May receive board content and action items. */
  canViewDetail: boolean;
  /** May create or re-establish a participant. On a completed board only existing participants. */
  canJoin: boolean;
}

export function decideBoardAccess(i: BoardAccessInput): BoardAccessDecision {
  const existingParticipant = i.hasParticipantRow || i.userMatchedParticipant;
  const canViewDetail =
    existingParticipant || i.userIsOwner || i.userIsMember || i.userIsSystemAdmin;
  const canJoin = !i.archived || existingParticipant;
  const access: BoardAccess = i.archived && !canViewDetail ? BOARD_ACCESS[1] : BOARD_ACCESS[0];
  return { access, canViewDetail, canJoin };
}
