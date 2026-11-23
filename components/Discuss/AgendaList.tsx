'use client';

import { memo } from 'react';
import { Pill } from '@/components/common/Pill';
import { cn } from '@/utils/cn';
import { agendaCardsLabel, agendaCountLabel, agendaVotesLabel, type AgendaItem } from '@/lib/agenda';
import { NO_TOPICS_TEXT, NOW_PILL } from '@/lib/constants/agenda';

interface AgendaListProps {
  agenda: AgendaItem[];
  currentId: string | null;
  shownId: string | null;
  onSelect: (cardId: string) => void;
  /** The visible heading ('Agenda', or 'Topics' in Done); null when a sheet already shows it. */
  heading: string | null;
  /** Heading text per topic, from `topicHeading`. */
  headings: ReadonlyMap<string, string>;
}

export const AgendaList = memo(function AgendaList({
  agenda, currentId, shownId, onSelect, heading, headings,
}: AgendaListProps) {
  return (
    <div data-testid="agenda">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        {heading !== null && <h3 className="text-base font-semibold text-[var(--ink)]">{heading}</h3>}
        <span className="text-xs text-[var(--ink-3)]">{agendaCountLabel(agenda.length)}</span>
      </div>
      {agenda.length === 0 ? (
        <p className="text-[13px] text-[var(--ink-3)]">{NO_TOPICS_TEXT}</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {agenda.map((item) => {
            const isCurrent = item.cardId === currentId;
            const selected = item.cardId === shownId && !isCurrent;
            const cardsLabel = agendaCardsLabel(item.cardIds.length);
            return (
              <li key={item.cardId}>
                <button
                  type="button"
                  data-testid="agenda-item"
                  aria-current={isCurrent ? 'true' : undefined}
                  onClick={() => onSelect(item.cardId)}
                  className={cn(
                    'flex min-h-11 w-full items-start gap-3 rounded-[var(--r-md)] border px-3 py-2 text-left transition-colors',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]',
                    isCurrent
                      ? 'border-transparent bg-[var(--accent-soft)]'
                      : selected
                        ? 'border-[var(--accent)] bg-[var(--surface)]'
                        : 'border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-muted)]',
                  )}
                >
                  <span className="mt-0.5 w-5 shrink-0 text-right text-xs font-semibold tabular-nums text-[var(--ink-3)]">
                    {item.rank}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 break-words text-sm font-medium text-[var(--ink)]">
                      {headings.get(item.cardId) ?? ''}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-x-3 text-xs text-[var(--ink-3)]">
                      <span>{agendaVotesLabel(item.score)}</span>
                      {cardsLabel !== null && <span>{cardsLabel}</span>}
                    </span>
                  </span>
                  {isCurrent && <Pill variant="tinted" className="shrink-0">{NOW_PILL}</Pill>}
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
});
