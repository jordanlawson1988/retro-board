import type { BoardAction } from '@/lib/constants/board-actions';
import {
  checkAction,
  type ActionTarget,
  type BoardActor,
  type BoardState,
  type GuardResult,
} from '@/lib/board-guards';

const EDIT_FIELDS = ['text', 'color'] as const;
const MOVE_FIELDS = ['column_id', 'position', 'merged_with'] as const;

/** Which guarded actions a card PATCH `updates` object touches. A mixed request needs all of them. */
export function cardPatchActions(updates: Record<string, unknown>): BoardAction[] {
  const has = (k: string) => updates[k] !== undefined;
  const actions: BoardAction[] = [];
  if (EDIT_FIELDS.some(has)) actions.push('card.edit');
  if (MOVE_FIELDS.some(has)) actions.push('card.move');
  if (has('reactions')) actions.push('card.react');
  return actions;
}

/** Removing yourself is `participant.leave`; removing anyone else is `participant.manage`. */
export function participantRemovalAction(
  actorParticipantId: string | null,
  targetParticipantId: string | null
): 'participant.leave' | 'participant.manage' {
  return actorParticipantId !== null && actorParticipantId === targetParticipantId
    ? 'participant.leave'
    : 'participant.manage';
}

/** Board PATCH: only a `settings` change goes through the board.settings guard. */
export function patchNeedsSettingsGuard(body: Record<string, unknown>): boolean {
  return body.settings !== undefined;
}

export interface BuildActorInput {
  boardId: string;
  trustVersion: 1 | 2;
  /** Verified participant id from the signed cookie (v2). */
  cookieParticipantId: string | null;
  /** The participants row for that id on this board, or null if it does not exist. */
  cookieParticipant: { is_admin: boolean } | null;
  /** The id the request body claimed (v1 only). */
  legacyParticipantId: string | null;
  userId: string | null;
  /** Signed-in owner / facilitator member / system admin. */
  hasAuthority: boolean;
}

/** Pure: resolve who is acting. v2 trusts only the cookie; v1 keeps the body-claimed id. */
export function buildActor(i: BuildActorInput): BoardActor {
  if (i.trustVersion === 2) {
    const participant = i.cookieParticipantId !== null ? i.cookieParticipant : null;
    return {
      boardId: i.boardId,
      trustVersion: 2,
      participantId: participant ? i.cookieParticipantId : null,
      userId: i.userId,
      isFacilitator: i.hasAuthority || !!participant?.is_admin,
    };
  }
  return {
    boardId: i.boardId,
    trustVersion: 1,
    participantId: i.legacyParticipantId,
    userId: i.userId,
    isFacilitator: i.hasAuthority,
  };
}

/** Run several guards; return the first denial or null when all pass. */
export function firstDenial(
  actions: BoardAction[],
  actor: BoardActor,
  state: BoardState,
  target: ActionTarget = {}
): Extract<GuardResult, { ok: false }> | null {
  for (const action of actions) {
    const r = checkAction(action, actor, state, target);
    if (!r.ok) return r;
  }
  return null;
}

export interface YouAre {
  participantId: string | null;
  isFacilitator: boolean;
  joined: boolean;
}

export interface ResolveYouAreInput {
  trustVersion: 1 | 2;
  /** v2: participant resolved from the signed cookie, else null. */
  actorParticipantId: string | null;
  actorIsFacilitator: boolean;
  /** The signed-in user's own participant row on this board (a hint, not identity). */
  matchedParticipantId: string | null;
  /** Signed-in owner / facilitator member / system admin. */
  authorityCanFacilitate: boolean;
}

/**
 * Pure: what the board GET tells the viewer about themselves. On v2 the participant is
 * exactly the cookie's; the user-matched row is only exposed separately as a join hint.
 */
export function resolveYouAre(i: ResolveYouAreInput): YouAre {
  if (i.trustVersion === 2) {
    return {
      participantId: i.actorParticipantId,
      isFacilitator: i.actorIsFacilitator || i.authorityCanFacilitate,
      joined: i.actorParticipantId !== null,
    };
  }
  return {
    participantId: i.matchedParticipantId,
    isFacilitator: i.authorityCanFacilitate,
    joined: i.matchedParticipantId !== null,
  };
}

export const CREATOR_PROTECTED_ERROR = 'The board creator cannot be demoted or removed';

export interface CreatorProtectionInput {
  change: 'demote' | 'remove';
  target: { id: string; user_id: string | null };
  board: { created_by: string | null; owner_id: string | null };
  actorParticipantId: string | null;
}

/** Pure: the board creator (or owner account's participant) cannot be demoted, or removed by others. */
export function checkCreatorProtection(i: CreatorProtectionInput): GuardResult {
  const isCreator =
    (i.board.created_by !== null && i.target.id === i.board.created_by) ||
    (i.board.owner_id !== null && i.target.user_id === i.board.owner_id);
  if (!isCreator) return { ok: true };
  if (i.change === 'remove' && i.actorParticipantId !== null && i.actorParticipantId === i.target.id) {
    return { ok: true };
  }
  return { ok: false, status: 403, error: CREATOR_PROTECTED_ERROR };
}
