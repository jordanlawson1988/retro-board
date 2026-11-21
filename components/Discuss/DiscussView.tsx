'use client';

import { AgendaList } from './AgendaList';
import { TopicPanel, ViewingAnotherBar } from './TopicPanel';
import { useDiscussTopics } from './useDiscussTopics';
import { AGENDA_HEADING, NO_TOPICS_TEXT, TOPICS_HEADING } from '@/lib/constants/agenda';

/** Desktop Discuss and Done: the agenda on the left, the shown topic on the right. */
export function DiscussView({ isFacilitator }: { isFacilitator: boolean }) {
  const { agenda, headings, followable, current, shown, controls, select } = useDiscussTopics(isFacilitator);
  const item = agenda.find((i) => i.cardId === shown) ?? null;
  return (
    <div data-testid="discuss-view" className="mx-auto max-w-[1400px] px-4 pt-6 pb-6 sm:px-6 md:pb-20">
      <div className="md:grid md:grid-cols-[minmax(240px,320px)_1fr] md:items-start md:gap-6">
        <AgendaList
          agenda={agenda}
          currentId={current}
          shownId={shown}
          onSelect={select}
          heading={followable ? AGENDA_HEADING : TOPICS_HEADING}
          headings={headings}
        />
        <div className="flex min-w-0 flex-col gap-3">
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
              layout="desktop"
            />
          )}
        </div>
      </div>
    </div>
  );
}
