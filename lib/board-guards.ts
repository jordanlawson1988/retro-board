import type { BoardSettings, CardReactions } from '@/types';
import type { BoardAction } from '@/lib/constants/board-actions';
import type { PhaseId } from '@/lib/constants/phases';
import { phaseDenial } from '@/lib/phases';

export interface BoardActor {
  boardId: string;
  trustVersion: 1 | 2;
  /** v2: from the signed cookie. v1: whatever the request body claimed. */
  participantId: string | null;
  userId: string | null;
  /** Signed-in authority, or (v2 only) participants.is_admin. */
  isFacilitator: boolean;
}

export interface BoardState {
  archived: boolean;
  settings: BoardSettings;
  /** Guided-mode phase; null on an open board. */
  phase: PhaseId | null;
}

export interface ActionTarget {
  authorId?: string | null;
  participantId?: string | null;
}

export type GuardResult =
  | { ok: true }
  | { ok: false; status: 401 | 403 | 409; error: string };

const OK: GuardResult = { ok: true };

function deny(status: 401 | 403 | 409, error: string): GuardResult {
  return { ok: false, status, error };
}

const FACILITATOR_REQUIRED = 'Facilitator access required';

function isLockable(action: BoardAction): boolean {
  return (
    action === 'card.create' ||
    action === 'card.edit' ||
    action === 'card.delete' ||
    action === 'card.move' ||
    action === 'group.title' ||
    action === 'card.react' ||
    action === 'vote.toggle' ||
    action === 'action-item.write' ||
    action === 'comment.create' ||
    action === 'comment.edit' ||
    action === 'comment.delete' ||
    action === 'action-item.link'
  );
}

/** Rule 1: board state. Applies to every board, v1 and v2. */
function checkState(action: BoardAction, actor: BoardActor, state: BoardState): GuardResult {
  // Leaving stays possible on a completed board so people can still remove themselves.
  if (state.archived && action !== 'participant.leave') return deny(409, 'Board is completed');
  // Phase rules bind facilitators too: no bypass.
  if (state.phase !== null) {
    const msg = phaseDenial(action, state.phase);
    if (msg) return deny(409, msg);
  }
  if (state.settings.board_locked && !actor.isFacilitator && isLockable(action)) {
    return deny(409, 'Board is locked');
  }
  if (action === 'vote.toggle' && !state.settings.voting_enabled) {
    return deny(409, 'Voting is closed');
  }
  if (
    action === 'card.create' &&
    state.settings.card_creation_disabled &&
    !actor.isFacilitator
  ) {
    return deny(409, 'Card creation is off');
  }
  return OK;
}

/** Rule 2: identity. v2 only. */
function checkIdentity(
  action: BoardAction,
  actor: BoardActor,
  target: ActionTarget
): GuardResult {
  if (actor.participantId === null && !actor.isFacilitator) {
    return deny(401, 'Join the board first');
  }

  switch (action) {
    case 'card.edit':
    case 'card.delete': {
      if (actor.isFacilitator) return OK;
      const ownsCard =
        actor.participantId !== null &&
        target.authorId != null &&
        target.authorId === actor.participantId;
      return ownsCard ? OK : deny(403, 'Only the author can change this card');
    }
    case 'column.write':
    case 'participant.manage':
    case 'board.settings':
    case 'group.reset':
    case 'topic.set':
      return actor.isFacilitator ? OK : deny(403, FACILITATOR_REQUIRED);
    case 'participant.leave': {
      const isSelf =
        actor.participantId !== null &&
        target.participantId != null &&
        target.participantId === actor.participantId;
      return isSelf ? OK : deny(403, 'You can only leave as yourself');
    }
    // Who wrote a comment is decided inside the comment statements, as card ownership is in the cards PATCH.
    case 'card.create':
    case 'card.move':
    case 'group.title':
    case 'card.react':
    case 'vote.toggle':
    case 'action-item.write':
    case 'comment.create':
    case 'comment.edit':
    case 'comment.delete':
    case 'action-item.link':
      return OK;
    default: {
      const unhandled: never = action;
      return deny(403, `Unhandled action: ${String(unhandled)}`);
    }
  }
}

export function checkAction(
  action: BoardAction,
  actor: BoardActor,
  state: BoardState,
  target: ActionTarget = {}
): GuardResult {
  const stateResult = checkState(action, actor, state);
  if (!stateResult.ok) return stateResult;

  // Fail closed: only an explicit trustVersion of 1 takes the legacy path.
  if (actor.trustVersion !== 1) return checkIdentity(action, actor, target);

  // Rule 3: v1 skips identity rules except board.settings.
  if (
    (action === 'board.settings' || action === 'group.reset' || action === 'topic.set') &&
    !actor.isFacilitator
  ) {
    return deny(403, FACILITATOR_REQUIRED);
  }
  return OK;
}

/**
 * True when, for every emoji, the symmetric difference between the previous and
 * next id lists is empty or exactly [participantId].
 */
export function reactionsChangeOnlyTouches(
  prev: CardReactions,
  next: CardReactions,
  participantId: string
): boolean {
  // Reject malformed or duplicated input before comparing.
  if (typeof next !== 'object' || next === null || Array.isArray(next)) return false;
  for (const ids of Object.values(next)) {
    if (!Array.isArray(ids)) return false;
    if (!ids.every((id) => typeof id === 'string')) return false;
    if (new Set(ids).size !== ids.length) return false;
  }
  const emojis = new Set([...Object.keys(prev ?? {}), ...Object.keys(next ?? {})]);
  for (const emoji of emojis) {
    const a = new Set(prev?.[emoji] ?? []);
    const b = new Set(next?.[emoji] ?? []);
    const diff: string[] = [];
    for (const id of a) if (!b.has(id)) diff.push(id);
    for (const id of b) if (!a.has(id)) diff.push(id);
    if (diff.length === 0) continue;
    if (diff.length === 1 && diff[0] === participantId) continue;
    return false;
  }
  return true;
}
