import { actionItemsForTopic, buildAgenda, topicHeading } from '@/lib/agenda';
import { threadsFor, type CommentThread } from '@/lib/comments';
import { ACTION_ITEM_STATUS_LABELS, SUMMARY_ANONYMOUS, SUMMARY_PAGE_TITLE } from '@/lib/constants/summary';
import { GUIDED_MODE } from '@/lib/constants/phases';
import { compareByCreated } from '@/lib/groups';
import { sumVoteCounts } from '@/lib/votes';
import { exportCardText } from '@/utils/cardText';
import type { ActionItem, ActionItemStatus, Board, Card, Comment, Participant, Vote } from '@/types';

export interface SummaryInput {
  board: Pick<Board, 'id' | 'title' | 'archived_at'>;
  /** Shaped. */
  cards: readonly Card[];
  /** Shaped (a completed board's votes are never secret). */
  votes: readonly Vote[];
  /** Shaped. */
  comments: readonly Comment[];
  actionItems: readonly ActionItem[];
  participants: readonly Pick<Participant, 'id' | 'display_name' | 'joined_at'>[];
}

/** A card of a topic. No author: a summary is printed and forwarded. */
export interface SummaryCard {
  id: string;
  text: string;
  isChild: boolean;
}

export interface SummaryTopic {
  cardId: string;
  rank: number;
  heading: string;
  score: number;
  /** The root first, then its children in creation order. */
  cards: SummaryCard[];
  threads: CommentThread[];
  actionItems: ActionItem[];
}

export interface SummaryHeadline {
  participants: number;
  cards: number;
  votes: number;
  topics: number;
  comments: number;
  actionItems: number;
}

export interface RetroSummary {
  boardId: string;
  title: string;
  completedAt: string | null;
  headline: SummaryHeadline;
  topics: SummaryTopic[];
  /** card_id null, absent, or not a card of any topic; oldest first. */
  otherActionItems: ActionItem[];
  participantNames: string[];
}

export type SummaryViewState =
  | { kind: 'not-found' }
  | { kind: 'failed' }
  | { kind: 'closed'; boardId: string; title: string }
  | { kind: 'not-completed'; boardId: string; title: string }
  | { kind: 'ready'; summary: RetroSummary };

const codeUnitOrder = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Lowercased name in code-unit order, then join time, then id. No locale dependence. */
export function compareParticipants(
  a: Pick<Participant, 'id' | 'display_name' | 'joined_at'>,
  b: Pick<Participant, 'id' | 'display_name' | 'joined_at'>,
): number {
  return (
    codeUnitOrder(a.display_name.toLowerCase(), b.display_name.toLowerCase()) ||
    Date.parse(a.joined_at) - Date.parse(b.joined_at) ||
    codeUnitOrder(a.id, b.id)
  );
}

export function buildRetroSummary(input: SummaryInput): RetroSummary {
  const { board, cards, votes, comments, actionItems, participants } = input;
  const agenda = buildAgenda(cards, votes);
  const topicCardIds = new Set(agenda.flatMap((i) => i.cardIds));
  const topics: SummaryTopic[] = agenda.map((item) => ({
    cardId: item.cardId,
    rank: item.rank,
    heading: topicHeading(item, cards),
    score: item.score,
    cards: item.cardIds.flatMap((id) => {
      const card = cards.find((c) => c.id === id);
      return card ? [{ id, text: exportCardText(card), isChild: id !== item.cardId }] : [];
    }),
    threads: threadsFor(comments, item.cardIds),
    actionItems: actionItemsForTopic(actionItems, item.cardIds),
  }));
  const otherActionItems = actionItems
    .filter((i) => i.card_id == null || !topicCardIds.has(i.card_id))
    .sort(compareByCreated);
  return {
    boardId: board.id,
    title: board.title,
    completedAt: board.archived_at,
    headline: {
      participants: participants.length,
      cards: cards.length,
      votes: sumVoteCounts(votes),
      topics: agenda.length,
      comments: comments.filter((c) => c.deleted_at === null).length,
      actionItems: actionItems.length,
    },
    topics,
    otherActionItems,
    participantNames: [...participants].sort(compareParticipants).map((p) => p.display_name),
  };
}

const HEADLINE_ORDER: { key: keyof SummaryHeadline; one: string; many: string }[] = [
  { key: 'participants', one: 'participant', many: 'participants' },
  { key: 'cards', one: 'card', many: 'cards' },
  { key: 'votes', one: 'vote', many: 'votes' },
  { key: 'topics', one: 'topic', many: 'topics' },
  { key: 'comments', one: 'comment', many: 'comments' },
  { key: 'actionItems', one: 'action item', many: 'action items' },
];

/** The six headline numbers with their labels, singular only for exactly 1. */
export function headlineItems(h: SummaryHeadline): { key: keyof SummaryHeadline; value: number; label: string }[] {
  return HEADLINE_ORDER.map(({ key, one, many }) => ({ key, value: h[key], label: h[key] === 1 ? one : many }));
}

export function headlineSentence(h: SummaryHeadline): string {
  return headlineItems(h)
    .map((i) => `${i.value} ${i.label}`)
    .join(', ');
}

/** Never "You", whatever is_mine says: the summary reads the same for every reader. */
export function summaryCommentAuthor(c: Comment): string {
  if (c.deleted_at !== null) return '';
  if (c.is_anonymous || !c.author_name) return SUMMARY_ANONYMOUS;
  return c.author_name;
}

const dateFormat = (timeZone?: string) =>
  new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone });

export function completedOnLabel(iso: string, timeZone?: string): string {
  return `Completed on ${dateFormat(timeZone).format(new Date(iso))}`;
}

/** A due date is a calendar date: formatted in UTC from its first 10 characters, so no time zone moves it. */
export function dueDateLabel(v: string | null | undefined): string | null {
  if (typeof v !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.slice(0, 10));
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const at = new Date(Date.UTC(y, mo - 1, d));
  if (at.getUTCFullYear() !== y || at.getUTCMonth() !== mo - 1 || at.getUTCDate() !== d) return null;
  return dateFormat('UTC').format(at);
}

export function ownerLabel(item: Pick<ActionItem, 'assignee'>): string | null {
  const name = item.assignee?.trim();
  return name ? name : null;
}

export function statusLabel(s: ActionItemStatus): string {
  return ACTION_ITEM_STATUS_LABELS[s];
}

/** Each topic's items in agenda order, then the others. */
export function allActionItems(s: RetroSummary): ActionItem[] {
  return [...s.topics.flatMap((t) => t.actionItems), ...s.otherActionItems];
}

export function summaryAvailable(board: Pick<Board, 'mode' | 'archived_at'> | null): boolean {
  return board?.mode === GUIDED_MODE && board.archived_at !== null;
}

export function summaryPath(boardId: string): string {
  return `/board/${boardId}/summary`;
}

export function summaryDocumentTitle(title: string): string {
  return `${SUMMARY_PAGE_TITLE}: ${title}`;
}

const asArray = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** Maps the board GET answer to what the summary page shows. */
export function summaryViewState(status: number, body: unknown): SummaryViewState {
  if (status === 404) return { kind: 'not-found' };
  if (status !== 200 || !body || typeof body !== 'object') return { kind: 'failed' };
  const b = body as Record<string, unknown>;
  const board = b.board;
  if (!board || typeof board !== 'object') return { kind: 'failed' };
  const stub = board as { id?: unknown; title?: unknown; mode?: unknown; archived_at?: unknown };
  const boardId = String(stub.id ?? '');
  const title = typeof stub.title === 'string' ? stub.title : '';
  if (b.access === 'completed-closed') return { kind: 'closed', boardId, title };
  if (stub.mode !== GUIDED_MODE) return { kind: 'not-found' };
  if (stub.archived_at === null || stub.archived_at === undefined) return { kind: 'not-completed', boardId, title };
  return {
    kind: 'ready',
    summary: buildRetroSummary({
      board: { id: boardId, title, archived_at: String(stub.archived_at) },
      cards: asArray<Card>(b.cards),
      votes: asArray<Vote>(b.votes),
      comments: asArray<Comment>(b.comments),
      actionItems: asArray<ActionItem>(b.actionItems),
      participants: asArray<Participant>(b.participants),
    }),
  };
}
