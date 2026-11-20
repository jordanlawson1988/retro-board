'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { playTimerDing, resumeAudioContext } from '@/lib/audio';
import { useBoardStore } from '@/stores/boardStore';
import { IDLE_TIMER, pausedTimer, resumedTimer, sameTimerView, startedTimer, timerView } from '@/lib/timer-state';
import type { TimerState } from '@/types';

/**
 * Timer for guided boards. State lives in board.settings.timer, so every participant (and a late
 * joiner) derives the same view from the stored state and the clock. Writes happen only on
 * start/pause/resume/reset; the local tick is a re-render, never a publish.
 */
export function useStoredTimer({ enabled }: { enabled: boolean }) {
  const stored = useBoardStore((s) => s.board?.settings.timer);
  const updateSettings = useBoardStore((s) => s.updateSettings);
  const [now, setNow] = useState(() => Date.now());

  const base: TimerState = enabled && stored ? stored : IDLE_TIMER;
  const timer = timerView(base, now);

  const storedRef = useRef(base);
  useEffect(() => {
    storedRef.current = base;
  });

  // Poll every 250ms only while the derived view is running; stops by itself at expiry. State
  // changes only when the displayed second or status changes, so the board re-renders once a second.
  const running = enabled && timer.status === 'running';
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setNow((prev) => {
        const next = Date.now();
        return sameTimerView(timerView(storedRef.current, prev), timerView(storedRef.current, next)) ? prev : next;
      });
    }, 250);
    return () => clearInterval(id);
  }, [running]);

  // Ding once when this client sees a running timer reach zero; never on loading an expired one.
  const prevStatus = useRef(timer.status);
  useEffect(() => {
    if (enabled && prevStatus.current === 'running' && timer.status === 'expired') playTimerDing();
    prevStatus.current = timer.status;
  }, [enabled, timer.status]);

  const write = useCallback(
    (next: TimerState) => {
      if (!enabled) return;
      void updateSettings({ timer: next }).catch(() => {});
    },
    [enabled, updateSettings]
  );

  const start = useCallback((duration: number) => {
    resumeAudioContext();
    write(startedTimer(duration, Date.now()));
  }, [write]);
  const pause = useCallback(() => write(pausedTimer(storedRef.current, Date.now())), [write]);
  const resume = useCallback(() => {
    resumeAudioContext();
    write(resumedTimer(storedRef.current, Date.now()));
  }, [write]);
  const reset = useCallback(() => write(IDLE_TIMER), [write]);

  return { timer, start, pause, resume, reset };
}
