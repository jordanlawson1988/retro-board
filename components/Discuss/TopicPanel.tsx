'use client';

import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { RetroCard } from '@/components/Board/RetroCard';
import { CommentThread } from '@/components/Discuss/CommentThread';
import { Pill } from '@/components/common/Pill';
import { cn } from '@/utils/cn';
import { useBoardStore } from '@/stores/boardStore';
import { useDiscussStore } from '@/stores/discussStore';
import { useGroupVoteStore } from '@/stores/groupVoteStore';
import { useCardText } from '@/hooks/useCardText';
import { isMine } from '@/utils/isMine';
import { hasVotedOn, voteTotalsByCard, votesUsedBy } from '@/lib/votes';
import {
  topicControls, topicFollowable, topicPositionLabel, type AgendaItem,
} from '@/lib/agenda';
import {
  BACK_TO_CURRENT_TOPIC, CURRENT_TOPIC_PILL, DISCUSS_THIS_TOPIC, FIRST_TOPIC_TITLE, LAST_TOPIC_TITLE,
  NEXT_TEXT, NEXT_TOPIC_LABEL, PREVIOUS_TEXT, PREVIOUS_TOPIC_LABEL, TOPIC_CARDS_HEADING, VIEWING_ANOTHER_TOPIC,
} from '@/lib/constants/agenda';
import type { CardReactions } from '@/types';

const BUTTON =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-medium text-[var(--ink)] transition-colors hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-50 md:min-h-9 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]';

/** Above the panel: a participant who is looking at a topic other than the current one. */
export function ViewingAnotherBar() {
  const viewTopic = useDiscussStore((s) => s.viewTopic);
  return (
    <div
      data-testid="viewing-another"
      className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--r-md)] bg-[var(--accent-soft)] px-3 py-2"
    >
      <p className="text-[13px] font-medium text-[var(--ink)]">{VIEWING_ANOTHER_TOPIC}</p>
      <button type="button" onClick={() => viewTopic(null)} className={BUTTON}>
        {BACK_TO_CURRENT_TOPIC}
      </button>
    </div>
  );
}

interface TopicPanelProps {
  item: AgendaItem | null;
  /** The topic's heading, from `topicHeading`, computed once by `useDiscussTopics`. */
  heading: string;
  agenda: AgendaItem[];
  currentId: string | null;
  isFacilitator: boolean;
  layout: 'desktop' | 'phone';
}

/** One topic: its heading, position, the facilitator's controls, and its cards through `RetroCard`. */
export function TopicPanel({ item, heading, agenda, currentId, isFacilitator, layout }: TopicPanelProps) {
  const board = useBoardStore((s) => s.board);
  const cards = useBoardStore((s) => s.cards);
  const votes = useBoardStore((s) => s.votes);
  const participants = useBoardStore((s) => s.participants);
  const currentParticipantId = useBoardStore((s) => s.currentParticipantId);
  const updateCard = useBoardStore((s) => s.updateCard);
  const deleteCard = useBoardStore((s) => s.deleteCard);
  const toggleReaction = useBoardStore((s) => s.toggleReaction);
  const settingTopic = useDiscussStore((s) => s.settingTopic);
  const setTopic = useDiscussStore((s) => s.setTopic);
  const toggleGuidedVote = useGroupVoteStore((s) => s.toggleGuidedVote);
  const cardText = useCardText();
  const totals = useMemo(() => voteTotalsByCard(votes), [votes]);

  if (!board || !item) return null;

  const shown = item.cardId;
  const followable = topicFollowable(board);
  const controls = topicControls({ followable, isFacilitator, agenda, current: currentId, shown });
  const isCurrent = followable && shown === currentId;
  const position = topicPositionLabel(agenda, shown);
  const phone = layout === 'phone';

  const go = (cardId: string | null) => {
    if (cardId !== null) setTopic(cardId).catch(() => {});
  };

  const isCompleted = !!board.archived_at;
  const settings = board.settings;
  const votesUsed = votesUsedBy(votes, currentParticipantId);

  return (
    <section data-testid="topic-panel" aria-label={heading} className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        {!phone && position !== null && <span className="text-xs font-medium text-[var(--ink-3)]">{position}</span>}
        {isCurrent && <Pill variant="tinted">{CURRENT_TOPIC_PILL}</Pill>}
        {controls.canMove && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {controls.canDiscussShown && (
              <button type="button" onClick={() => go(shown)} disabled={settingTopic} className={BUTTON}>
                {DISCUSS_THIS_TOPIC}
              </button>
            )}
            {!phone && (
              <>
                <button
                  type="button"
                  aria-label={PREVIOUS_TOPIC_LABEL}
                  title={controls.previousId === null ? FIRST_TOPIC_TITLE : undefined}
                  disabled={controls.previousId === null || settingTopic}
                  onClick={() => go(controls.previousId)}
                  className={BUTTON}
                >
                  <ChevronLeft size={16} aria-hidden />
                  {PREVIOUS_TEXT}
                </button>
                <button
                  type="button"
                  aria-label={NEXT_TOPIC_LABEL}
                  title={controls.nextId === null ? LAST_TOPIC_TITLE : undefined}
                  disabled={controls.nextId === null || settingTopic}
                  onClick={() => go(controls.nextId)}
                  className={BUTTON}
                >
                  {NEXT_TEXT}
                  <ChevronRight size={16} aria-hidden />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <h3 title={heading} className="mt-2 line-clamp-3 break-words text-lg font-semibold leading-snug text-[var(--ink)]">
        {heading}
      </h3>

      <h4 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">
        {TOPIC_CARDS_HEADING}
      </h4>
      <div className="flex flex-col gap-2">
        {item.cardIds.map((id, i) => {
          const card = cards.find((c) => c.id === id);
          if (!card) return null;
          const child = i > 0;
          return (
            <div key={id} className={cn(child && 'ml-4 border-l-2 border-[var(--line)] pl-3')}>
              <RetroCard
                id={card.id}
                text={cardText(card)}
                textHidden={card.text_hidden}
                authorName={card.author_name}
                authorId={card.author_id}
                color={card.color}
                voteCount={child ? (totals.get(id) ?? 0) : item.score}
                votes={votes}
                hasVoted={hasVotedOn(true, votes, cards, id, currentParticipantId)}
                isAuthor={isMine(card, currentParticipantId)}
                isObscured={settings.card_visibility === 'hidden'}
                votingEnabled={settings.voting_enabled}
                secretVoting={settings.secret_voting}
                voteLimitReached={votesUsed >= settings.max_votes_per_participant}
                onUpdate={updateCard}
                onDelete={deleteCard}
                onToggleVote={(cardId) => { toggleGuidedVote(cardId).catch(() => {}); }}
                reactions={(card.reactions ?? {}) as CardReactions}
                onToggleReaction={toggleReaction}
                isCompleted={isCompleted}
                currentParticipantId={currentParticipantId}
                canMerge={false}
                isChildCard={child}
                participants={participants}
              />
            </div>
          );
        })}
      </div>
      <CommentThread rootId={shown} cardIds={item.cardIds} isFacilitator={isFacilitator} />
    </section>
  );
}
