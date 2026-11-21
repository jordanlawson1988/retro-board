import { describe, it, expect } from 'vitest';
import {
  buildRetroSummary, headlineItems, headlineSentence, summaryCommentAuthor, completedOnLabel, dueDateLabel,
  ownerLabel, statusLabel, allActionItems, summaryAvailable, summaryViewState, summaryPath, summaryDocumentTitle,
} from '@/lib/summary';

const at = (ms: number) => new Date(Date.UTC(2026, 10, 21, 10, 0, 0, ms)).toISOString();
const card = (id: string, ms: number, merged_with: string | null = null, group_title: string | null = null) => ({
  id, column_id: 'col', board_id: 'b1', text: `text ${id}`, author_name: 'Ann', author_id: 'p1', color: null,
  position: 0, merged_with, group_title, reactions: {}, created_at: at(ms), updated_at: at(ms),
});
const vote = (card_id: string, voter_id: string, count = 1) =>
  ({ id: `${card_id}-${voter_id}`, card_id, board_id: 'b1', voter_id, count, created_at: at(0) });
const comment = (over: Record<string, unknown>) => ({ id: 'm', board_id: 'b1', card_id: 'L', parent_id: null,
  author_participant_id: 'p1', author_name: 'Ann', is_anonymous: false, body: 'hi', created_at: at(0),
  edited_at: null, deleted_at: null, is_mine: false, ...over });
const item = (id: string, ms: number, card_id: string | null, over: Record<string, unknown> = {}) => ({
  id, board_id: 'b1', description: `do ${id}`, assignee: null, due_date: null, status: 'open', created_at: at(ms), card_id, ...over,
});

const input = {
  board: { id: 'b1', title: 'Sprint 12', archived_at: at(999) },
  cards: [card('L', 1, null, 'Deploys'), card('k', 2, 'L'), card('S', 3), card('Z', 4)],
  votes: [vote('L', 'p1', 2), vote('k', 'p2'), vote('S', 'p1')],
  comments: [
    comment({ id: 'c1', created_at: at(1) }),
    comment({ id: 'c2', parent_id: 'c1', is_anonymous: true, author_participant_id: null, author_name: null, is_mine: true, created_at: at(2) }),
    comment({ id: 'c3', card_id: 'S', deleted_at: at(3), body: '', author_name: null, author_participant_id: null }),
  ],
  actionItems: [item('i2', 2, 'k'), item('i1', 1, 'L'), item('i3', 3, null), item('i4', 4, 'gone')],
  participants: [
    { id: 'p2', display_name: 'bo', joined_at: at(2) }, { id: 'p1', display_name: 'Ann', joined_at: at(1) },
    { id: 'p3', display_name: 'cy', joined_at: at(3) },
  ],
};

describe('buildRetroSummary', () => {
  const s = buildRetroSummary(input as never);
  it('topics follow the agenda: group score, then creation order', () => {
    expect(s.topics.map((t) => [t.cardId, t.rank, t.score, t.heading])).toEqual([
      ['L', 1, 3, 'Deploys'], ['S', 2, 1, 'text S'], ['Z', 3, 0, 'text Z'],
    ]);
    expect(s.topics[0].cards).toEqual([{ id: 'L', text: 'text L', isChild: false }, { id: 'k', text: 'text k', isChild: true }]);
  });
  it('a topic carries its threads (a lone deleted comment is left out) and its items, children included', () => {
    expect(s.topics[0].threads.map((t) => [t.top.id, t.replies.map((r) => r.id)])).toEqual([['c1', ['c2']]]);
    expect(s.topics[1].threads).toEqual([]);
    expect(s.topics[0].actionItems.map((i) => i.id)).toEqual(['i1', 'i2']);
    expect(s.otherActionItems.map((i) => i.id)).toEqual(['i3', 'i4']);
    expect(allActionItems(s).map((i) => i.id)).toEqual(['i1', 'i2', 'i3', 'i4']);
  });
  it('headline numbers', () => {
    expect(s.headline).toEqual({ participants: 3, cards: 4, votes: 4, topics: 3, comments: 2, actionItems: 4 });
    expect(headlineSentence({ participants: 1, cards: 1, votes: 0, topics: 1, comments: 0, actionItems: 0 }))
      .toBe('1 participant, 1 card, 0 votes, 1 topic, 0 comments, 0 action items');
    expect(headlineItems(s.headline).map((h) => h.label)).toEqual(['participants', 'cards', 'votes', 'topics', 'comments', 'action items']);
  });
  it('participants by name without locale rules; title and completion', () => {
    expect(s.participantNames).toEqual(['Ann', 'bo', 'cy']);
    expect([s.boardId, s.title, s.completedAt]).toEqual(['b1', 'Sprint 12', at(999)]);
  });
  it('an empty board has no topics and zero counts', () => {
    const e = buildRetroSummary({ ...input, cards: [], votes: [], comments: [], actionItems: [], participants: [] } as never);
    expect(e.topics).toEqual([]);
    expect(e.headline).toEqual({ participants: 0, cards: 0, votes: 0, topics: 0, comments: 0, actionItems: 0 });
  });
});

describe('labels', () => {
  it('a comment author is never "You"; anonymous stays anonymous for its own author', () => {
    expect(summaryCommentAuthor(comment({ is_anonymous: true, author_name: null, author_participant_id: null, is_mine: true }) as never)).toBe('Anonymous');
    expect(summaryCommentAuthor(comment({ is_mine: true }) as never)).toBe('Ann');
    expect(summaryCommentAuthor(comment({ deleted_at: at(1), body: '', author_name: null }) as never)).toBe('');
  });
  it('dates', () => {
    expect(completedOnLabel('2026-11-21T23:30:00.000Z', 'UTC')).toBe('Completed on November 21, 2026');
    expect(completedOnLabel('2026-11-21T23:30:00.000Z', 'Asia/Tokyo')).toBe('Completed on November 22, 2026');
    expect(dueDateLabel('2026-11-30')).toBe('November 30, 2026');
    expect(dueDateLabel('2026-11-30T00:00:00.000Z')).toBe('November 30, 2026');
    expect(dueDateLabel(null)).toBeNull();
    expect(dueDateLabel('nope')).toBeNull();
  });
  it('owner and status', () => {
    expect(ownerLabel({ assignee: '  ' })).toBeNull();
    expect(ownerLabel({ assignee: ' Bo ' })).toBe('Bo');
    expect(statusLabel('in_progress')).toBe('In progress');
  });
  it('paths and availability', () => {
    expect(summaryPath('b1')).toBe('/board/b1/summary');
    expect(summaryDocumentTitle('Sprint 12')).toBe('Retro summary: Sprint 12');
    expect(summaryAvailable({ mode: 'guided', archived_at: at(1) })).toBe(true);
    expect(summaryAvailable({ mode: 'guided', archived_at: null })).toBe(false);
    expect(summaryAvailable({ mode: 'open', archived_at: at(1) })).toBe(false);
    expect(summaryAvailable(null)).toBe(false);
  });
});

describe('summaryViewState', () => {
  const full = { access: 'open', board: { id: 'b1', title: 'T', mode: 'guided', archived_at: at(9) },
    cards: input.cards, votes: input.votes, comments: input.comments, actionItems: input.actionItems, participants: input.participants };
  it('maps the board GET answer', () => {
    expect(summaryViewState(404, null)).toEqual({ kind: 'not-found' });
    expect(summaryViewState(500, null)).toEqual({ kind: 'failed' });
    expect(summaryViewState(200, { access: 'completed-closed', board: { id: 'b1', title: 'T', archived_at: at(1), trust_version: 2 } }))
      .toEqual({ kind: 'closed', boardId: 'b1', title: 'T' });
    expect(summaryViewState(200, { ...full, board: { ...full.board, mode: 'open' } })).toEqual({ kind: 'not-found' });
    expect(summaryViewState(200, { ...full, board: { ...full.board, archived_at: null } }))
      .toEqual({ kind: 'not-completed', boardId: 'b1', title: 'T' });
    const ready = summaryViewState(200, full);
    expect(ready.kind === 'ready' && ready.summary.topics.length).toBe(3);
    const noComments = summaryViewState(200, { ...full, comments: undefined });
    expect(noComments.kind === 'ready' && noComments.summary.headline.comments).toBe(0);
  });
});
