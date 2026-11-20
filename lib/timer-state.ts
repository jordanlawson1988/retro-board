import type { TimerState } from '@/types';

/**
 * Stored timer arithmetic for guided boards. One meaning for the fields:
 * - running: `started_at` is the instant the countdown would have begun with no pauses, so
 *   remaining = duration - floor((now - started_at) / 1000). `remaining` is the value at the
 *   last transition and is not read while running.
 * - paused: `remaining` is frozen; `started_at` is kept but unused.
 * - expired / idle: `remaining` is 0.
 * The same formula as the open-board timer, so a view needs only the stored state and the clock.
 */
export const IDLE_TIMER: TimerState = { duration: 0, remaining: 0, status: 'idle', started_at: null };

export function startedTimer(duration: number, nowMs: number): TimerState {
  return { duration, remaining: duration, status: 'running', started_at: new Date(nowMs).toISOString() };
}

export function timerView(t: TimerState, nowMs: number): TimerState {
  if (t.status !== 'running' || !t.started_at) return t;
  const elapsed = Math.floor((nowMs - Date.parse(t.started_at)) / 1000);
  const remaining = Math.min(t.duration, Math.max(0, t.duration - elapsed));
  return remaining <= 0 ? { ...t, remaining: 0, status: 'expired' } : { ...t, remaining };
}

export function pausedTimer(t: TimerState, nowMs: number): TimerState {
  if (t.status !== 'running') return t;
  const view = timerView(t, nowMs);
  if (view.status === 'expired') return view;
  return { ...t, remaining: view.remaining, status: 'paused' };
}

export function resumedTimer(t: TimerState, nowMs: number): TimerState {
  if (t.status !== 'paused') return t;
  const startedAt = new Date(nowMs - (t.duration - t.remaining) * 1000).toISOString();
  return { ...t, status: 'running', started_at: startedAt };
}
