'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/Layout';
import { SummaryView } from './SummaryView';
import { useAuthStore } from '@/stores/authStore';
import { summaryDocumentTitle, summaryPath, summaryViewState, type SummaryViewState } from '@/lib/summary';
import { COMPLETED_CLOSED_MESSAGE } from '@/lib/constants/board-access';
import {
  BACK_TO_BOARD,
  BOARD_NOT_FOUND_TITLE,
  GO_HOME,
  SUMMARY_LOAD_FAILED,
  SUMMARY_LOADING,
  SUMMARY_NOT_READY,
  SUMMARY_RETRY,
  SUMMARY_SIGN_IN_LINK,
  SUMMARY_SIGN_IN_PROMPT,
} from '@/lib/constants/summary';

const LINK_BUTTON =
  'mt-6 inline-flex min-h-11 items-center justify-center rounded-[var(--r-md)] border border-transparent bg-[var(--ink)] px-4 text-[13px] font-medium text-[var(--bg-elev)] hover:bg-[var(--ink-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]';
const TEXT_LINK =
  'font-medium text-[var(--accent)] underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]';

type PageState = { kind: 'loading' } | SummaryViewState;

/**
 * The summary of a completed guided retro. It is a snapshot: one request to the board GET per mount
 * and per "Try again", no timers, no polling, no realtime. Who sees what is decided only by that
 * response (the full payload or the minimal "completed, closed to you" payload).
 */
export function SummaryPage({ boardId }: { boardId: string }) {
  const [state, setState] = useState<PageState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authLoading = useAuthStore((s) => s.loading);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      let next: SummaryViewState;
      try {
        const res = await fetch(`/api/boards/${boardId}`, { cache: 'no-store', signal: controller.signal });
        let body: unknown = null;
        try {
          body = await res.json();
        } catch {
          body = null;
        }
        next = summaryViewState(res.status, body);
      } catch {
        next = { kind: 'failed' };
      }
      if (controller.signal.aborted) return;
      setState(next);
    })();
    return () => controller.abort();
  }, [boardId, attempt]);

  const readyTitle = state.kind === 'ready' ? state.summary.title : null;
  useEffect(() => {
    if (readyTitle !== null) document.title = summaryDocumentTitle(readyTitle);
  }, [readyTitle]);

  const retry = () => {
    setState({ kind: 'loading' });
    setAttempt((n) => n + 1);
  };

  if (state.kind === 'ready') {
    return (
      <AppShell>
        <SummaryView summary={state.summary} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          {state.kind === 'loading' && (
            <p role="status" className="text-[var(--ink-4)]">
              {SUMMARY_LOADING}
            </p>
          )}
          {state.kind === 'failed' && (
            <div role="status">
              <p className="text-[var(--ink)]">{SUMMARY_LOAD_FAILED}</p>
              <button type="button" onClick={retry} className={LINK_BUTTON}>
                {SUMMARY_RETRY}
              </button>
            </div>
          )}
          {state.kind === 'not-found' && (
            <>
              <h2 className="text-[var(--ink)]">{BOARD_NOT_FOUND_TITLE}</h2>
              <Link href="/" className={LINK_BUTTON}>
                {GO_HOME}
              </Link>
            </>
          )}
          {state.kind === 'closed' && (
            <>
              <h2 className="break-words text-[var(--ink)]">{state.title}</h2>
              <p className="mt-2 text-[var(--ink-2)]">{COMPLETED_CLOSED_MESSAGE}</p>
              {!authLoading && !isAuthenticated && (
                <p className="mt-4 text-[var(--ink-2)]">
                  {SUMMARY_SIGN_IN_PROMPT}{' '}
                  <Link href={`/login?redirect=${encodeURIComponent(summaryPath(boardId))}`} className={TEXT_LINK}>
                    {SUMMARY_SIGN_IN_LINK}
                  </Link>
                </p>
              )}
              <Link href="/" className={LINK_BUTTON}>
                {GO_HOME}
              </Link>
            </>
          )}
          {state.kind === 'not-completed' && (
            <>
              <h2 className="break-words text-[var(--ink)]">{state.title}</h2>
              <p className="mt-2 text-[var(--ink-2)]">{SUMMARY_NOT_READY}</p>
              <Link href={`/board/${boardId}`} className={LINK_BUTTON}>
                {BACK_TO_BOARD}
              </Link>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
