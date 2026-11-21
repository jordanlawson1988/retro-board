'use client';

import { AgendaList } from './AgendaList';
import { TopicPanel, ViewingAnotherBar } from './TopicPanel';
import { useDiscussTopics } from './useDiscussTopics';
import { AGENDA_HEADING, TOPICS_HEADING } from '@/lib/constants/agenda';

/** Desktop Discuss and Done: the agenda on the left, the shown topic on the right. */
export function DiscussView({ isFacilitator }: { isFacilitator: boolean }) {
  const { agenda, headings, followable, current, shown, controls, select } = useDiscussTopics(isFacilitator);
  const item = agenda.find((i) => i.cardId === shown) ?? null;
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
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
          <TopicPanel item={item} agenda={agenda} currentId={current} isFacilitator={isFacilitator} layout="desktop" />
        </div>
      </div>
    </div>
  );
}
