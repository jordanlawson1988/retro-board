import {
  GUIDED_MAX_VOTES_PER_CARD,
  OPEN_MAX_VOTES_PER_CARD,
} from '@/lib/constants/board-settings';
import { GUIDED_MODE, PHASES, type BoardMode } from '@/lib/constants/phases';
import type { Board, BoardSettings, Card, Vote } from '@/types';

export const GROUP_VOTE_ERROR = 'Votes go on the group, not on a card inside it';
export const GUIDED_ACTION_REQUIRED_ERROR = 'Guided boards take add or remove';
export const NO_VOTE_TO_REMOVE_ERROR = 'You have no vote on this card';
export const NO_VOTES_LEFT = 'No votes left';
export const VOTE_LIMIT_RELATION_ERROR = 'Votes per card cannot be more than votes per person';
export const CARD_LIMIT_OPEN_ERROR = 'Votes per card is only available on guided boards';

/** A vote row without `count` (open boards, databases without migration 016) weighs 1. */
export function voteWeight(v: { count?: number }): number {
  return v.count ?? 1;
}

export function sumVoteCounts(votes: readonly { count?: number }[]): number {
  return votes.reduce((n, v) => n + voteWeight(v), 0);
}

export function voteTotalsByCard(votes: readonly Vote[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const v of votes) totals.set(v.card_id, (totals.get(v.card_id) ?? 0) + voteWeight(v));
  return totals;
}

export function votesUsedBy(votes: readonly Vote[], participantId: string | null): number {
  if (!participantId) return 0;
  return sumVoteCounts(votes.filter((v) => v.voter_id === participantId));
}

export function myVotesOn(votes: readonly Vote[], cardId: string, participantId: string | null): number {
  if (!participantId) return 0;
  return sumVoteCounts(votes.filter((v) => v.card_id === cardId && v.voter_id === participantId));
}

/** A group scores its lead card plus its children. */
export function groupScore(
  cardId: string,
  cards: readonly Pick<Card, 'id' | 'merged_with'>[],
  totals: ReadonlyMap<string, number>,
): number {
  let score = totals.get(cardId) ?? 0;
  for (const c of cards) if (c.merged_with === cardId) score += totals.get(c.id) ?? 0;
  return score;
}

export function maxVotesPerCard(settings: Pick<BoardSettings, 'max_votes_per_card'>): number {
  return settings.max_votes_per_card ?? OPEN_MAX_VOTES_PER_CARD;
}

/** The per-card limit a new guided board starts with: 3, but never more than votes per person. */
export function guidedVoteDefaults(settings: Record<string, unknown>): { max_votes_per_card: number } {
  const perPerson = settings.max_votes_per_participant;
  const cap = typeof perPerson === 'number' && Number.isInteger(perPerson) && perPerson >= 1 ? perPerson : Infinity;
  return { max_votes_per_card: Math.min(GUIDED_MAX_VOTES_PER_CARD, cap) };
}

export function voteControlKind(
  mode: BoardMode,
  settings: Pick<BoardSettings, 'max_votes_per_card'>,
): 'toggle' | 'stepper' {
  return mode === GUIDED_MODE && maxVotesPerCard(settings) > 1 ? 'stepper' : 'toggle';
}

export function votesPerCardError(n: number): string {
  return `You can put at most ${n} ${n === 1 ? 'vote' : 'votes'} on one card`;
}

export interface VoteControlInput {
  onCard: number;
  spent: number;
  perCard: number;
  perPerson: number;
  childCard: boolean;
}

export function voteControlState(i: VoteControlInput): {
  canAdd: boolean;
  canRemove: boolean;
  addBlockedReason: string | null;
} {
  let addBlockedReason: string | null = null;
  if (i.childCard) addBlockedReason = GROUP_VOTE_ERROR;
  else if (i.spent >= i.perPerson) addBlockedReason = NO_VOTES_LEFT;
  else if (i.onCard >= i.perCard) addBlockedReason = votesPerCardError(i.perCard);
  return { canAdd: addBlockedReason === null, canRemove: i.onCard > 0, addBlockedReason };
}

/** Optimistic change to my own vote row on a card; removes the row when it reaches zero. */
export function applyVoteDelta(
  votes: readonly Vote[],
  d: { boardId: string; cardId: string; voterId: string; voteId: string; delta: 1 | -1; nowIso: string },
): Vote[] {
  const index = votes.findIndex((v) => v.card_id === d.cardId && v.voter_id === d.voterId);
  if (index === -1) {
    if (d.delta === -1) return votes as Vote[];
    return [
      ...votes,
      { id: d.voteId, card_id: d.cardId, board_id: d.boardId, voter_id: d.voterId, count: 1, created_at: d.nowIso },
    ];
  }
  const next = voteWeight(votes[index]) + d.delta;
  if (next <= 0) return votes.filter((_, i) => i !== index);
  return votes.map((v, i) => (i === index ? { ...v, count: next } : v));
}

/** Replace (or remove, when `vote` is null) only my row on that card with the server's answer. */
export function settleOwnVote(
  votes: readonly Vote[],
  s: { cardId: string; voterId: string; vote: Vote | null },
): Vote[] {
  const mine = (v: Vote) => v.card_id === s.cardId && v.voter_id === s.voterId;
  const index = votes.findIndex(mine);
  if (index === -1) return s.vote ? [...votes, s.vote] : [...votes];
  const settled = s.vote;
  return votes.flatMap((v, i) => (!mine(v) ? [v] : i === index && settled ? [settled] : []));
}

export interface VoteTally {
  used: number;
  at: number;
}

/** Newer or equal tally wins; an older or malformed one leaves the current tally as it was. */
export function applyVoteTally(current: VoteTally | null, incoming: unknown): VoteTally | null {
  if (!incoming || typeof incoming !== 'object') return current;
  const { used, at } = incoming as { used?: unknown; at?: unknown };
  if (typeof used !== 'number' || !Number.isInteger(used) || used < 0) return current;
  if (typeof at !== 'number' || !Number.isFinite(at)) return current;
  if (current && at < current.at) return current;
  return { used, at };
}

export function teamVotesRemaining(perPerson: number, participantCount: number, used: number): number {
  return Math.max(0, perPerson * participantCount - used);
}

/** The team number is shown only on a guided board in a voting phase, once a tally has arrived. */
export function teamVotesLeftFor(
  board: Pick<Board, 'mode' | 'phase' | 'settings' | 'archived_at'> | null,
  participantCount: number,
  tally: VoteTally | null,
): number | null {
  if (!board || board.mode !== GUIDED_MODE || !board.phase || board.archived_at || !tally) return null;
  if (!PHASES[board.phase].profile.canVote) return null;
  return teamVotesRemaining(board.settings.max_votes_per_participant, participantCount, tally.used);
}

export function teamVotesLabel(n: number): string {
  return `Team: ${n} ${n === 1 ? 'vote' : 'votes'} left`;
}

const LIMIT_KEYS = ['max_votes_per_participant', 'max_votes_per_card'] as const;

export function hasLimitKey(patch: Record<string, unknown>): boolean {
  return LIMIT_KEYS.some((k) => k in patch);
}

/** The merged limits must keep per card at or below per person. */
export function voteLimitProblem(current: BoardSettings, patch: Partial<BoardSettings>): string | null {
  const merged = { ...current, ...patch };
  return maxVotesPerCard(merged) > merged.max_votes_per_participant ? VOTE_LIMIT_RELATION_ERROR : null;
}

/** Why a lowering was refused: which limit it hit and how far it may go. */
export function limitRefusal(i: {
  perPerson: number | null;
  perCard: number | null;
  maxSpent: number;
  maxOnCard: number;
}): string {
  if (i.perPerson !== null && i.perPerson < i.maxSpent) {
    return `Votes per person cannot go below ${i.maxSpent}. Someone has already used ${i.maxSpent}.`;
  }
  if (i.perCard !== null && i.perCard < i.maxOnCard) {
    return `Votes per card cannot go below ${i.maxOnCard}. Someone already has ${i.maxOnCard} on one card.`;
  }
  return 'The board changed. Try again.';
}

/** Limits are editable on a guided board until totals show; after that a change has no effect. */
export function voteLimitsEditable(board: Pick<Board, 'mode' | 'phase' | 'archived_at'> | null): boolean {
  return (
    !!board &&
    board.mode === GUIDED_MODE &&
    board.phase !== null &&
    !board.archived_at &&
    !PHASES[board.phase].profile.canSeeTotals
  );
}

/** The one advisory-lock key for a board's guided votes. */
export function voteLockKey(boardId: string): string {
  return `${boardId}:votes`;
}

/**
 * The team's votes used after a guided add or remove. The statement reads every count BEFORE its
 * own insert, update or delete (one snapshot per statement), so the change is applied here.
 */
export function teamUsedAfter(teamUsedBefore: number, delta: 1 | -1): number {
  return teamUsedBefore + delta;
}
