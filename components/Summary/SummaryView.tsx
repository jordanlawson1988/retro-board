'use client';

import { useId, useSyncExternalStore } from 'react';
import Link from 'next/link';
import {
  completedOnLabel,
  dueDateLabel,
  headlineItems,
  ownerLabel,
  statusLabel,
  summaryPath,
  type RetroSummary,
  type SummaryComment,
  type SummaryTopic,
} from '@/lib/summary';
import { agendaCardsLabel, agendaVotesLabel } from '@/lib/agenda';
import { DELETED_COMMENT_TEXT } from '@/lib/constants/comments';
import { NO_OWNER_LABEL } from '@/lib/constants/agenda';
import {
  AT_A_GLANCE,
  BACK_TO_BOARD,
  DUE_PREFIX,
  NO_COMMENTS,
  NO_TOPIC_ACTIONS,
  NO_TOPICS_DISCUSSED,
  OTHER_ACTIONS,
  OWNER_PREFIX,
  PRINT_BUTTON,
  SUMMARY_CARDS,
  SUMMARY_DISCUSSION,
  SUMMARY_PARTICIPANTS,
  SUMMARY_PRINT_FOOTER_PREFIX,
  SUMMARY_TOPICS,
  SUMMARY_TOPIC_ACTIONS,
} from '@/lib/constants/summary';
import type { ActionItem } from '@/types';

const H2 = 'text-lg font-semibold text-[var(--ink)]';
const H4 = 'mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]';
const TEXT = 'whitespace-pre-wrap break-words';
const LINK =
  'inline-flex min-h-11 items-center rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-medium text-[var(--ink)] hover:bg-[var(--surface-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]';

const PRINT_BTN =
  'inline-flex min-h-11 items-center justify-center rounded-[var(--r-md)] border border-transparent bg-[var(--ink)] px-4 text-sm font-medium text-[var(--bg-elev)] hover:bg-[var(--ink-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]';

const subscribeNever = () => () => {};
const readOrigin = () => window.location.origin;
const readNoOrigin = () => '';

/** The read-only summary of a completed guided retro. Presentational: every decision is in lib/summary. */
export function SummaryView({ summary }: { summary: RetroSummary }) {
  const glanceId = useId();
  const topicsId = useId();
  const otherId = useId();
  const peopleId = useId();
  const completed = completedOnLabel(summary.completedAt);
  // The origin is only known in the browser. The server snapshot is '' (also used while hydrating), so
  // server and client agree on first render and the real origin appears right after mount.
  const origin = useSyncExternalStore(subscribeNever, readOrigin, readNoOrigin);

  return (
    <div
      data-summary-root
      data-testid="summary-root"
      className="mx-auto max-w-3xl px-4 py-8 text-[var(--ink-2)] sm:px-6"
    >
      <div data-testid="summary-toolbar" data-print-hide className="mb-6 flex flex-wrap items-center gap-2">
        <Link href={`/board/${summary.boardId}`} className={LINK}>
          {BACK_TO_BOARD}
        </Link>
        <button type="button" onClick={() => window.print()} className={PRINT_BTN}>
          {PRINT_BUTTON}
        </button>
      </div>

      <h1 className="break-words text-2xl font-semibold text-[var(--ink)]">{summary.title}</h1>
      {completed && <p className="mt-1 text-sm text-[var(--ink-3)]">{completed}</p>}

      <section aria-labelledby={glanceId} className="mt-8">
        <h2 id={glanceId} className={H2}>
          {AT_A_GLANCE}
        </h2>
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {headlineItems(summary.headline).map((item) => (
            <li
              key={item.key}
              data-testid="summary-stat"
              className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-3 py-3"
            >
              <div className="text-2xl font-semibold text-[var(--ink)]">{item.value}</div>
              <div className="text-sm text-[var(--ink-3)]">{item.label}</div>
            </li>
          ))}
        </ul>
      </section>

      {/* Step 5's AI summary section renders here, between "At a glance" and "Topics". Not built yet. */}

      <section aria-labelledby={topicsId} className="mt-10">
        <h2 id={topicsId} className={H2}>
          {SUMMARY_TOPICS}
        </h2>
        {summary.topics.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--ink-3)]">{NO_TOPICS_DISCUSSED}</p>
        ) : (
          <div className="mt-3 flex flex-col gap-6">
            {summary.topics.map((topic) => (
              <TopicSection key={topic.cardId} topic={topic} />
            ))}
          </div>
        )}
      </section>

      {summary.otherActionItems.length > 0 && (
        <section aria-labelledby={otherId} className="mt-10">
          <h2 id={otherId} className={H2}>
            {OTHER_ACTIONS}
          </h2>
          <div className="mt-3">
            <ActionItemList items={summary.otherActionItems} />
          </div>
        </section>
      )}

      <section aria-labelledby={peopleId} data-testid="summary-participants" className="mt-10">
        <h2 id={peopleId} className={H2}>
          {SUMMARY_PARTICIPANTS}
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {summary.participantNames.map((name, i) => (
            <li
              key={`${i}:${name}`}
              className="max-w-full break-words rounded-full bg-[var(--surface-muted)] px-3 py-1 text-sm text-[var(--ink-2)]"
            >
              {name}
            </li>
          ))}
        </ul>
      </section>

      <p data-print-only className="mt-10 text-sm">
        {origin ? `${SUMMARY_PRINT_FOOTER_PREFIX}${origin}${summaryPath(summary.boardId)}` : ''}
      </p>
    </div>
  );
}

function TopicSection({ topic }: { topic: SummaryTopic }) {
  const headingId = useId();
  const cardsLabel = agendaCardsLabel(topic.cards.length);
  return (
    <section
      data-testid="summary-topic"
      aria-labelledby={headingId}
      className="min-w-0 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] p-4"
    >
      <div data-print-avoid-break data-print-keep-next>
        <h3 id={headingId} className="break-words text-base font-semibold text-[var(--ink)]">
          {topic.rank}. {topic.heading}
        </h3>
        <p className="mt-1 text-sm text-[var(--ink-3)]">
          {agendaVotesLabel(topic.score)}
          {cardsLabel && ` · ${cardsLabel}`}
        </p>
      </div>

      <h4 className={`mt-4 ${H4}`}>{SUMMARY_CARDS}</h4>
      <ul className="flex flex-col gap-2">
        {topic.cards.map((card) => (
          <li
            key={card.id}
            data-print-avoid-break
            className={`${TEXT} text-[var(--ink-2)] ${card.isChild ? 'ml-6 border-l border-[var(--line)] pl-3' : ''}`}
          >
            {card.text}
          </li>
        ))}
      </ul>

      <h4 className={`mt-4 ${H4}`}>{SUMMARY_DISCUSSION}</h4>
      {topic.threads.length === 0 ? (
        <p className="text-sm text-[var(--ink-3)]">{NO_COMMENTS}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {topic.threads.map((thread) => (
            <li key={thread.top.id} data-print-avoid-break className="min-w-0">
              <CommentBlock comment={thread.top} />
              {thread.replies.length > 0 && (
                <ul className="ml-6 mt-2 flex flex-col gap-2 border-l border-[var(--line)] pl-3">
                  {thread.replies.map((reply) => (
                    <li key={reply.id} className="min-w-0">
                      <CommentBlock comment={reply} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      <h4 className={`mt-4 ${H4}`}>{SUMMARY_TOPIC_ACTIONS}</h4>
      {topic.actionItems.length === 0 ? (
        <p className="text-sm text-[var(--ink-3)]">{NO_TOPIC_ACTIONS}</p>
      ) : (
        <ActionItemList items={topic.actionItems} />
      )}
    </section>
  );
}

/** The author is already a finished label (never "You"); a deleted comment shows only its tombstone. */
function CommentBlock({ comment }: { comment: SummaryComment }) {
  if (comment.deleted) {
    return <p className="text-sm italic text-[var(--ink-3)]">{DELETED_COMMENT_TEXT}</p>;
  }
  return (
    <div>
      <p className="text-sm font-medium text-[var(--ink-3)]">{comment.author}</p>
      <p className={`${TEXT} text-[var(--ink-2)]`}>{comment.body}</p>
    </div>
  );
}

function ActionItemList({ items }: { items: readonly ActionItem[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => {
        const owner = ownerLabel(item);
        const due = dueDateLabel(item.due_date);
        return (
          <li key={item.id} data-print-avoid-break className="min-w-0">
            <p className={`${TEXT} text-[var(--ink)]`}>{item.description}</p>
            <p className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-[var(--ink-3)]">
              <span className="break-words">{owner ? `${OWNER_PREFIX}${owner}` : NO_OWNER_LABEL}</span>
              {due && <span>{`${DUE_PREFIX}${due}`}</span>}
              <span>{statusLabel(item.status)}</span>
            </p>
          </li>
        );
      })}
    </ul>
  );
}
