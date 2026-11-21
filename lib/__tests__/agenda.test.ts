import { describe, it, expect } from 'vitest';
import {
  buildAgenda, currentTopicId, shownTopicId, neighbourTopicId, topicPositionLabel, agendaCountLabel,
  agendaVotesLabel, agendaCardsLabel, topicHeading, discussViewShown, topicFollowable, actionItemsForTopic,
  phaseTopic, topicActionOutcome, assignOutcome, setTopicOutcome,
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
