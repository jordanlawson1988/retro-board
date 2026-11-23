'use client';

import { useEffect, useState } from 'react';
import { useBoardStore } from '@/stores/boardStore';
import { GUIDED_MODE } from '@/lib/constants/phases';
import { deadlineNotice, deadlineRecheckMs } from '@/lib/phases';

/** setTimeout cannot wait longer than about 24.8 days; re-check at least this often. */
const MAX_TIMEOUT_MS = 6 * 3_600_000;

/**
 * The deadline notice for the board's current phase (see `deadlineNotice`), or null when there
 * is none. Shared by the desktop chip and banner and the phone stepper. It re-evaluates by
 * itself when the deadline falls due, so the open notice turns into the passed one without a
 * reload. Local only: it never publishes anything.
 */
export function usePhaseDeadline() {
  const board = useBoardStore((s) => s.board);
  const [now, setNow] = useState(() => Date.now());
  const deadline = board?.phase_config?.deadline ?? null;

  useEffect(() => {
    const wait = deadlineRecheckMs(deadline, Date.now(), MAX_TIMEOUT_MS);
    if (wait === null) return;
    const t = setTimeout(() => setNow(Date.now()), wait);
    return () => clearTimeout(t);
  }, [deadline, now]);

  if (!board || board.mode !== GUIDED_MODE || !board.phase) return null;
  return deadlineNotice(board.phase, deadline, now);
}
