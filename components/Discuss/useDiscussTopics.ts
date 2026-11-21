'use client';

import { useCallback, useMemo } from 'react';
import { useBoardStore } from '@/stores/boardStore';
import { useDiscussStore } from '@/stores/discussStore';
import { useCardText } from '@/hooks/useCardText';
import {
  buildAgenda, discussTopics, selectTopicAction, topicControls, topicFollowable, topicHeading,
} from '@/lib/agenda';

/**
 * The one place a Discuss view derives its agenda, current and shown topic, headings and click
 * behaviour. Mounted only while `discussViewShown`, so open boards never run it.
 */
export function useDiscussTopics(isFacilitator: boolean) {
  const board = useBoardStore((s) => s.board);
  const cards = useBoardStore((s) => s.cards);
  const votes = useBoardStore((s) => s.votes);
  const viewed = useDiscussStore((s) => s.viewed);
  const viewTopic = useDiscussStore((s) => s.viewTopic);
  const setTopic = useDiscussStore((s) => s.setTopic);
  const cardText = useCardText();

  const agenda = useMemo(() => buildAgenda(cards, votes), [cards, votes]);
  const headings = useMemo(() => {
    const texts = cards.map((c) => ({ id: c.id, text: cardText(c) }));
    return new Map(agenda.map((item) => [item.cardId, topicHeading(item, texts)]));
  }, [agenda, cards, cardText]);

  const followable = topicFollowable(board);
  const { current, shown } = useMemo(() => discussTopics(board, agenda, viewed), [board, agenda, viewed]);
  const controls = useMemo(
    () => topicControls({ followable, isFacilitator, agenda, current, shown }),
    [followable, isFacilitator, agenda, current, shown],
  );

  // A rejected set-topic is already on the connection banner; nothing more to do here.
  const move = useCallback((cardId: string | null) => {
    if (cardId !== null) setTopic(cardId).catch(() => {});
  }, [setTopic]);

  const select = useCallback((cardId: string) => {
    const action = selectTopicAction(followable, isFacilitator, cardId, current);
    if (action.kind === 'set') move(action.cardId);
    else viewTopic(action.cardId);
  }, [followable, isFacilitator, current, move, viewTopic]);

  return { agenda, headings, followable, current, shown, controls, select, move };
}
