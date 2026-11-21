import { AGENDA_PHASE, GUIDED_MODE, type PhaseConfig, type PhaseId } from '@/lib/constants/phases';
import { compareByCreated, isRootCard, visibleGroupTitle } from '@/lib/groups';
import { groupScore, voteTotalsByCard } from '@/lib/votes';
import type { ActionItem, Board, Card, Vote } from '@/types';

export interface AgendaItem {
  cardId: string;
  rank: number;
  score: number;
  /** The root, then its children in creation order. */
  cardIds: string[];
  /** The lead card's visible group title. */
  title: string | null;
}

/**
 * Every root card (lead or solo, across all columns) ordered by group score descending, then
 * creation order. Cards with no votes follow every voted card in that same order. Ranks start at 1.
 */
export function buildAgenda(
  cards: readonly Pick<Card, 'id' | 'merged_with' | 'created_at' | 'group_title'>[],
  votes: readonly Vote[],
): AgendaItem[] {
  const totals = voteTotalsByCard(votes);
  const roots = cards
    .filter((c) => isRootCard(c.id, cards))
    .map((c) => ({ card: c, score: groupScore(c.id, cards, totals) }))
    .sort((a, b) => b.score - a.score || compareByCreated(a.card, b.card));
  return roots.map(({ card, score }, i) => ({
    cardId: card.id,
    rank: i + 1,
    score,
    cardIds: [card.id, ...cards.filter((c) => c.merged_with === card.id).sort(compareByCreated).map((c) => c.id)],
    title: visibleGroupTitle(card.id, cards),
  }));
}

/** The stored topic id from a phase config, else null. */
export function phaseTopic(config: Partial<PhaseConfig> | null | undefined): string | null {
  const topic = config?.topic;
  return typeof topic === 'string' ? topic : null;
}

/**
 * The stored topic when the agenda has it, else the first item. A topic whose card was deleted
 * falls back to the first item, the same on every client.
 */
export function currentTopicId(agenda: readonly AgendaItem[], stored: string | null): string | null {
  if (stored !== null && agenda.some((i) => i.cardId === stored)) return stored;
  return agenda[0]?.cardId ?? null;
}

export interface ViewedTopic {
  boardId: string;
  phase: PhaseId;
  cardId: string;
}

/** The topic this person chose to look at, while it applies; else the topic everyone follows. */
export function shownTopicId(
  agenda: readonly AgendaItem[],
  current: string | null,
  viewed: ViewedTopic | null,
  at: { boardId: string | null; phase: PhaseId | null },
): string | null {
  if (
    viewed &&
    viewed.boardId === at.boardId &&
    viewed.phase === at.phase &&
    agenda.some((i) => i.cardId === viewed.cardId)
  ) {
    return viewed.cardId;
  }
  return current;
}

export function neighbourTopicId(
  agenda: readonly AgendaItem[],
  cardId: string | null,
  step: 1 | -1,
): string | null {
  if (cardId === null) return null;
  const at = agenda.findIndex((i) => i.cardId === cardId);
  if (at === -1) return null;
  return agenda[at + step]?.cardId ?? null;
}

export function topicPositionLabel(agenda: readonly AgendaItem[], cardId: string | null): string | null {
  if (cardId === null) return null;
  const at = agenda.findIndex((i) => i.cardId === cardId);
  return at === -1 ? null : `Topic ${at + 1} of ${agenda.length}`;
}

export function agendaCountLabel(n: number): string {
  return n === 1 ? '1 topic' : `${n} topics`;
}

export function agendaVotesLabel(n: number): string {
  if (n === 0) return 'No votes';
  return n === 1 ? '1 vote' : `${n} votes`;
}

export function agendaCardsLabel(n: number): string | null {
  return n > 1 ? `${n} cards` : null;
}

/** The title; else the group size; else the root card's text. */
export function topicHeading(item: AgendaItem, cards: readonly Pick<Card, 'id' | 'text'>[]): string {
  if (item.title !== null) return item.title;
  if (item.cardIds.length > 1) return `Group of ${item.cardIds.length} cards`;
  return cards.find((c) => c.id === item.cardId)?.text ?? '';
}

/** The Discuss view shows in Discuss and Done of a guided board. */
export function discussViewShown(board: Pick<Board, 'mode' | 'phase'> | null): boolean {
  return board?.mode === GUIDED_MODE && (board.phase === AGENDA_PHASE || board.phase === 'done');
}

/** A current topic exists only in Discuss, before completion. */
export function topicFollowable(board: Pick<Board, 'mode' | 'phase' | 'archived_at'> | null): boolean {
  return board?.mode === GUIDED_MODE && board.phase === AGENDA_PHASE && board.archived_at === null;
}

/** Action items linked to any card of the topic, oldest first. */
export function actionItemsForTopic<
  A extends Pick<ActionItem, 'id' | 'created_at'> & { card_id?: string | null },
>(items: readonly A[], cardIds: readonly string[]): A[] {
  return items
    .filter((i) => i.card_id != null && cardIds.includes(i.card_id))
    .sort(compareByCreated);
}

/** Maps the row of the add-topic-action statement. */
export function topicActionOutcome(row: {
  board_ok: boolean;
  topic_ok: boolean;
  owner_ok: boolean;
  id: unknown;
}): 'ok' | 'phase-changed' | 'topic-missing' | 'owner-missing' {
  if (!row.board_ok) return 'phase-changed';
  if (!row.topic_ok) return 'topic-missing';
  if (!row.owner_ok) return 'owner-missing';
  return row.id === null || row.id === undefined ? 'phase-changed' : 'ok';
}

/** Maps the row of the assign statement. */
export function assignOutcome(row: {
  board_ok: boolean;
  owner_ok: boolean;
  id: unknown;
}): 'ok' | 'phase-changed' | 'owner-missing' | 'item-missing' {
  if (!row.board_ok) return 'phase-changed';
  if (!row.owner_ok) return 'owner-missing';
  return row.id === null || row.id === undefined ? 'item-missing' : 'ok';
}

/** Maps the row of the set-topic statement: a missing topic first, then a moved phase. */
export function setTopicOutcome(
  row: { topic_ok: boolean; phase: unknown } | undefined,
): 'ok' | 'topic-missing' | 'phase-changed' {
  if (!row || !row.topic_ok) return 'topic-missing';
  return row.phase === null || row.phase === undefined ? 'phase-changed' : 'ok';
}
