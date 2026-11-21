'use client';

import { useCallback, useState } from 'react';
import { ChevronLeft, ChevronRight, ListOrdered } from 'lucide-react';
import { MobileSheet } from '@/components/common/Sheet';
import { AgendaList } from './AgendaList';
import { TopicPanel, ViewingAnotherBar } from './TopicPanel';
import { useDiscussTopics } from './useDiscussTopics';
import { useDiscussStore } from '@/stores/discussStore';
import { agendaCountLabel, topicPositionLabel } from '@/lib/agenda';
import {
  AGENDA_HEADING, FIRST_TOPIC_TITLE, LAST_TOPIC_TITLE, NEXT_TOPIC_LABEL, NO_TOPICS_TEXT, PREVIOUS_TOPIC_LABEL,
  TOPICS_HEADING,
} from '@/lib/constants/agenda';

const TOUCH =
  'grid min-h-11 min-w-11 shrink-0 place-items-center rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]';

/** Phone Discuss and Done: a top bar, an Agenda sheet, and the shown topic in the scroll region. */
export function MobileDiscuss({ isFacilitator }: { isFacilitator: boolean }) {
  const { agenda, headings, followable, current, shown, controls, select, move } = useDiscussTopics(isFacilitator);
  const settingTopic = useDiscussStore((s) => s.settingTopic);
  const [agendaOpen, setAgendaOpen] = useState(false);
  // Stable: the sheet re-registers Escape and Back handling whenever this changes.
  const closeAgenda = useCallback(() => setAgendaOpen(false), []);
  const onSelect = useCallback((cardId: string) => {
    // A click the store will drop (a topic change in flight) leaves the sheet open.
    if (select(cardId)) setAgendaOpen(false);
  }, [select]);

  const item = agenda.find((i) => i.cardId === shown) ?? null;
  const heading = followable ? AGENDA_HEADING : TOPICS_HEADING;
  const position = topicPositionLabel(agenda, shown) ?? agendaCountLabel(agenda.length);

  return (
    <>
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--line)] px-4 py-2">
        <p data-testid="topic-position" className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--ink-2)]">
          {position}
        </p>
        <button
          type="button"
          onClick={() => setAgendaOpen(true)}
          className={`${TOUCH} grid-flow-col gap-1.5 px-3 text-sm font-medium`}
        >
          <ListOrdered size={16} aria-hidden />
          {heading}
        </button>
        {controls.canMove && (
          <>
            <button
              type="button"
              aria-label={PREVIOUS_TOPIC_LABEL}
              title={controls.previousId === null ? FIRST_TOPIC_TITLE : undefined}
              disabled={controls.previousId === null || settingTopic}
              onClick={() => move(controls.previousId)}
              className={TOUCH}
            >
              <ChevronLeft size={20} aria-hidden />
            </button>
            <button
              type="button"
              aria-label={NEXT_TOPIC_LABEL}
              title={controls.nextId === null ? LAST_TOPIC_TITLE : undefined}
              disabled={controls.nextId === null || settingTopic}
              onClick={() => move(controls.nextId)}
              className={TOUCH}
            >
              <ChevronRight size={20} aria-hidden />
            </button>
          </>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 pt-3 pb-[calc(84px+var(--safe-bottom))]">
        {controls.viewingAnother && <ViewingAnotherBar />}
        {item === null ? (
          <p className="text-[13px] text-[var(--ink-3)]">{NO_TOPICS_TEXT}</p>
        ) : (
          <TopicPanel
            item={item}
            heading={headings.get(item.cardId) ?? ''}
            agenda={agenda}
            currentId={current}
            isFacilitator={isFacilitator}
            layout="phone"
          />
        )}
      </div>

      <MobileSheet open={agendaOpen} onClose={closeAgenda} label={heading} title={heading}>
        <AgendaList
          agenda={agenda}
          currentId={current}
          shownId={shown}
          onSelect={onSelect}
          heading={null}
          headings={headings}
        />
      </MobileSheet>
    </>
  );
}
