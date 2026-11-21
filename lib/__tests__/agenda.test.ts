import { describe, it, expect } from 'vitest';
import {
  buildAgenda, currentTopicId, shownTopicId, neighbourTopicId, topicPositionLabel, agendaCountLabel,
  agendaVotesLabel, agendaCardsLabel, topicHeading, discussViewShown, topicFollowable, actionItemsForTopic,
  phaseTopic, topicActionOutcome, assignOutcome, setTopicOutcome,
  discussTopics, selectTopicAction, topicControls,
} from '@/lib/agenda';

const at = (ms: number) => new Date(Date.UTC(2026, 10, 20, 10, 0, 0, ms)).toISOString();
const card = (id: string, ms: number, merged_with: string | null = null, group_title: string | null = null, text = `text ${id}`) =>
  ({ id, merged_with, group_title, text, created_at: at(ms) });
const vote = (card_id: string, voter_id: string, count = 1) =>
  ({ id: `${card_id}-${voter_id}`, card_id, board_id: 'b1', voter_id, count, created_at: at(0) });

describe('buildAgenda', () => {
  it('ranks root cards from every column by group score, a group counting its children', () => {
    const cards = [card('a', 1), card('b', 2), card('c', 3, 'b'), card('d', 4)];
    const agenda = buildAgenda(cards, [vote('a', 'p1', 2), vote('b', 'p1'), vote('c', 'p2', 2), vote('d', 'p2')]);
    expect(agenda.map((i) => [i.cardId, i.score, i.rank])).toEqual([['b', 3, 1], ['a', 2, 2], ['d', 1, 3]]);
    expect(agenda[0].cardIds).toEqual(['b', 'c']);
  });
  it('breaks ties by earliest creation to the millisecond, then id in code-unit order', () => {
    const cards = [card('z', 5), card('y', 5), card('B', 9), card('a', 9), card('x', 1)];
    const votes = cards.map((c) => vote(c.id, 'p1'));
    expect(buildAgenda(cards, votes).map((i) => i.cardId)).toEqual(['x', 'y', 'z', 'B', 'a']);
  });
  it('cards with no votes come after every voted card, in the same stable order', () => {
    expect(buildAgenda([card('n1', 1), card('v1', 2), card('n2', 0)], [vote('v1', 'p1')]).map((i) => i.cardId))
      .toEqual(['v1', 'n2', 'n1']);
  });
  it('lists children oldest first, treats a card whose parent is gone as a root, and shows a lead title', () => {
    const agenda = buildAgenda([card('L', 0, null, 'Deploys'), card('k2', 5, 'L'), card('k1', 3, 'L'), card('o', 9, 'gone')], []);
    expect(agenda.map((i) => i.cardId)).toEqual(['L', 'o']);
    expect(agenda[0].cardIds).toEqual(['L', 'k1', 'k2']);
    expect(agenda[0].title).toBe('Deploys');
    expect(agenda[1].title).toBeNull();
    expect(buildAgenda([], [])).toEqual([]);
  });
});

describe('current and shown topic', () => {
  const agenda = buildAgenda([card('a', 1), card('b', 2), card('c', 3)], []);
  it('the stored topic when it is on the agenda, else the first item, else null', () => {
    expect(currentTopicId(agenda, 'b')).toBe('b');
    expect(currentTopicId(agenda, 'gone')).toBe('a');
    expect(currentTopicId(agenda, null)).toBe('a');
    expect(currentTopicId([], 'a')).toBeNull();
  });
  it('a viewed topic shows only on the same board, in the same phase, while it is on the agenda', () => {
    const viewed = { boardId: 'b1', phase: 'discuss' as const, cardId: 'c' };
    expect(shownTopicId(agenda, 'a', viewed, { boardId: 'b1', phase: 'discuss' })).toBe('c');
    expect(shownTopicId(agenda, 'a', viewed, { boardId: 'b1', phase: 'done' })).toBe('a');
    expect(shownTopicId(agenda, 'a', viewed, { boardId: 'b2', phase: 'discuss' })).toBe('a');
    expect(shownTopicId(agenda, 'a', { ...viewed, cardId: 'gone' }, { boardId: 'b1', phase: 'discuss' })).toBe('a');
    expect(shownTopicId(agenda, 'a', null, { boardId: 'b1', phase: 'discuss' })).toBe('a');
  });
  it('neighbours and position', () => {
    expect(neighbourTopicId(agenda, 'b', 1)).toBe('c');
    expect(neighbourTopicId(agenda, 'b', -1)).toBe('a');
    expect(neighbourTopicId(agenda, 'c', 1)).toBeNull();
    expect(neighbourTopicId(agenda, 'a', -1)).toBeNull();
    expect(neighbourTopicId(agenda, null, 1)).toBeNull();
    expect(topicPositionLabel(agenda, 'b')).toBe('Topic 2 of 3');
    expect(topicPositionLabel(agenda, 'gone')).toBeNull();
  });
});

describe('labels and gates', () => {
  it('counts', () => {
    expect(agendaCountLabel(1)).toBe('1 topic');
    expect(agendaCountLabel(4)).toBe('4 topics');
    expect(agendaVotesLabel(0)).toBe('No votes');
    expect(agendaVotesLabel(1)).toBe('1 vote');
    expect(agendaVotesLabel(7)).toBe('7 votes');
    expect(agendaCardsLabel(1)).toBeNull();
    expect(agendaCardsLabel(3)).toBe('3 cards');
  });
  it('a heading is the title, else the group size, else the card text', () => {
    const cards = [card('L', 0, null, 'Deploys'), card('k', 1, 'L'), card('M', 2), card('m', 3, 'M'), card('S', 4)];
    const agenda = buildAgenda(cards, []);
    const byId = (id: string) => agenda.find((i) => i.cardId === id)!;
    expect(topicHeading(byId('L'), cards)).toBe('Deploys');
    expect(topicHeading(byId('M'), cards)).toBe('Group of 2 cards');
    expect(topicHeading(byId('S'), cards)).toBe('text S');
  });
  it('the Discuss view shows in Discuss and Done of a guided board; a topic is followed only in Discuss before completion', () => {
    expect(discussViewShown({ mode: 'guided', phase: 'discuss' })).toBe(true);
    expect(discussViewShown({ mode: 'guided', phase: 'done' })).toBe(true);
    expect(discussViewShown({ mode: 'guided', phase: 'vote' })).toBe(false);
    expect(discussViewShown({ mode: 'open', phase: null })).toBe(false);
    expect(discussViewShown(null)).toBe(false);
    expect(topicFollowable({ mode: 'guided', phase: 'discuss', archived_at: null })).toBe(true);
    expect(topicFollowable({ mode: 'guided', phase: 'done', archived_at: '2026-11-20' })).toBe(false);
    expect(phaseTopic({ deadline: null })).toBeNull();
    expect(phaseTopic({ deadline: null, topic: 'a' })).toBe('a');
  });
  it('topic actions are the items linked to any card of the topic, oldest first', () => {
    const items = [
      { id: '2', created_at: at(2), card_id: 'L' }, { id: '1', created_at: at(1), card_id: 'k' },
      { id: '3', created_at: at(3), card_id: null }, { id: '4', created_at: at(4) },
    ];
    expect(actionItemsForTopic(items, ['L', 'k']).map((i) => i.id)).toEqual(['1', '2']);
  });
  it('route outcomes', () => {
    const okRow = { board_ok: true, topic_ok: true, owner_ok: true, id: 'i1' };
    expect(topicActionOutcome(okRow)).toBe('ok');
    expect(topicActionOutcome({ ...okRow, board_ok: false })).toBe('phase-changed');
    expect(topicActionOutcome({ ...okRow, topic_ok: false, id: null })).toBe('topic-missing');
    expect(topicActionOutcome({ ...okRow, owner_ok: false, id: null })).toBe('owner-missing');
    expect(assignOutcome({ board_ok: true, owner_ok: true, id: null })).toBe('item-missing');
    expect(setTopicOutcome({ topic_ok: false, phase: null })).toBe('topic-missing');
    expect(setTopicOutcome({ topic_ok: true, phase: null })).toBe('phase-changed');
    expect(setTopicOutcome({ topic_ok: true, phase: 'discuss' })).toBe('ok');
  });
});

describe('outcome precedence and absent rows', () => {
  it('setTopicOutcome with no row means the phase changed', () => {
    expect(setTopicOutcome(undefined)).toBe('phase-changed');
  });
  it('topicActionOutcome: a moved board beats a missing topic', () => {
    expect(topicActionOutcome({ board_ok: false, topic_ok: false, owner_ok: true, id: null })).toBe('phase-changed');
  });
  it('topicActionOutcome: a missing topic beats a missing owner', () => {
    expect(topicActionOutcome({ board_ok: true, topic_ok: false, owner_ok: false, id: null })).toBe('topic-missing');
  });
  it('assignOutcome: a moved board beats a missing owner', () => {
    expect(assignOutcome({ board_ok: false, owner_ok: false, id: null })).toBe('phase-changed');
  });
});

describe('discussTopics', () => {
  const agenda = buildAgenda([card('a', 1), card('b', 2), card('c', 3)], [vote('c', 'p1')]);
  const board = (over: Record<string, unknown> = {}) =>
    ({ id: 'b1', mode: 'guided', phase: 'discuss', archived_at: null, phase_config: {}, ...over }) as never;
  it('follows the stored topic, falling back to the first item', () => {
    expect(discussTopics(board({ phase_config: { topic: 'b' } }), agenda, null)).toEqual({ current: 'b', shown: 'b' });
    expect(discussTopics(board({ phase_config: { topic: 'gone' } }), agenda, null)).toEqual({ current: 'c', shown: 'c' });
  });
  it('shows a viewed topic while it applies to this board and phase', () => {
    expect(discussTopics(board(), agenda, { boardId: 'b1', phase: 'discuss', cardId: 'a' })).toEqual({ current: 'c', shown: 'a' });
    expect(discussTopics(board(), agenda, { boardId: 'other', phase: 'discuss', cardId: 'a' }).shown).toBe('c');
  });
  it('has no current topic in Done but still shows the first or the viewed one', () => {
    const done = board({ phase: 'done', archived_at: 'x', phase_config: { topic: 'b' } });
    expect(discussTopics(done, agenda, null)).toEqual({ current: null, shown: 'c' });
    expect(discussTopics(done, agenda, { boardId: 'b1', phase: 'done', cardId: 'a' }).shown).toBe('a');
  });
  it('handles an empty agenda and no board', () => {
    expect(discussTopics(board(), [], null)).toEqual({ current: null, shown: null });
    expect(discussTopics(null, agenda, null)).toEqual({ current: null, shown: 'c' });
  });
});

describe('selectTopicAction', () => {
  it('a facilitator in Discuss sets the topic for everyone when it is not already current', () => {
    expect(selectTopicAction(true, true, 'a', 'b')).toEqual({ kind: 'set', cardId: 'a' });
  });
  // Changed on purpose: this used to pin a redundant set-topic request for the current topic.
  it('a facilitator clicking the topic that is already current sends nothing and clears their own view', () => {
    expect(selectTopicAction(true, true, 'b', 'b')).toEqual({ kind: 'view', cardId: null });
  });
  it('a facilitator with no current topic can still set one', () => {
    expect(selectTopicAction(true, true, 'a', null)).toEqual({ kind: 'set', cardId: 'a' });
  });
  it('a participant views; the current topic returns to following', () => {
    expect(selectTopicAction(true, false, 'a', 'b')).toEqual({ kind: 'view', cardId: 'a' });
    expect(selectTopicAction(true, false, 'b', 'b')).toEqual({ kind: 'view', cardId: null });
  });
  it('in Done everyone only views, facilitator included', () => {
    expect(selectTopicAction(false, true, 'a', null)).toEqual({ kind: 'view', cardId: 'a' });
  });
});

describe('topicControls', () => {
  const agenda = buildAgenda([card('a', 1), card('b', 2), card('c', 3)], []);
  const base = { followable: true, isFacilitator: true, agenda, current: 'b', shown: 'b' };
  it('a facilitator gets neighbours of the current topic and nothing to discuss when looking at it', () => {
    expect(topicControls(base)).toEqual({ canMove: true, previousId: 'a', nextId: 'c', canDiscussShown: false, viewingAnother: false });
  });
  it('has no neighbour past either end', () => {
    expect(topicControls({ ...base, current: 'a', shown: 'a' }).previousId).toBeNull();
    expect(topicControls({ ...base, current: 'c', shown: 'c' }).nextId).toBeNull();
  });
  it('a facilitator looking at another topic can discuss it; a participant sees the back bar', () => {
    expect(topicControls({ ...base, shown: 'a' }).canDiscussShown).toBe(true);
    expect(topicControls({ ...base, shown: 'a' }).viewingAnother).toBe(false);
    const p = topicControls({ ...base, isFacilitator: false, shown: 'a' });
    expect(p).toEqual({ canMove: false, previousId: null, nextId: null, canDiscussShown: false, viewingAnother: true });
  });
  it('offers nothing in Done', () => {
    expect(topicControls({ ...base, followable: false, current: null, shown: 'a' })).toEqual({
      canMove: false, previousId: null, nextId: null, canDiscussShown: false, viewingAnother: false,
    });
  });
});
