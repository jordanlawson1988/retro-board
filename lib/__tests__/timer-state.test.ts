import { describe, it, expect } from 'vitest';
import { IDLE_TIMER, startedTimer, pausedTimer, resumedTimer, timerView } from '@/lib/timer-state';
import { validateSettingsPatch } from '@/lib/board-validation';

const t0 = Date.parse('2026-11-18T12:00:00Z');

describe('timer-state', () => {
  it('a started timer counts down from its start time', () => {
    const t = startedTimer(300, t0);
    expect(timerView(t, t0 + 61_000)).toMatchObject({ status: 'running', remaining: 239 });
  });
  it('a participant loading mid-countdown sees the right time from stored state alone', () => {
    const stored = JSON.parse(JSON.stringify(startedTimer(300, t0)));
    expect(timerView(stored, t0 + 100_000).remaining).toBe(200);
  });
  it('expires at zero and never goes negative', () => {
    expect(timerView(startedTimer(60, t0), t0 + 90_000)).toMatchObject({ status: 'expired', remaining: 0 });
  });
  it('pause freezes the remaining time and resume continues from it', () => {
    const paused = pausedTimer(startedTimer(300, t0), t0 + 100_000);
    expect(paused).toMatchObject({ status: 'paused', remaining: 200 });
    expect(timerView(paused, t0 + 900_000)).toMatchObject({ status: 'paused', remaining: 200 });
    expect(timerView(resumedTimer(paused, t0 + 500_000), t0 + 510_000)).toMatchObject({ status: 'running', remaining: 190 });
  });
  it('idle and expired views pass through unchanged', () => {
    expect(timerView(IDLE_TIMER, t0)).toEqual(IDLE_TIMER);
  });
  it('pause and resume on a timer that is not in the right state change nothing', () => {
    expect(pausedTimer(IDLE_TIMER, t0)).toEqual(IDLE_TIMER);
    const running = startedTimer(60, t0);
    expect(resumedTimer(running, t0 + 5000)).toEqual(running);
  });
  it('every transition passes the settings validator', () => {
    const paused = pausedTimer(startedTimer(300, t0), t0 + 1000);
    for (const t of [IDLE_TIMER, startedTimer(300, t0), paused, resumedTimer(paused, t0 + 9000)]) {
      expect(validateSettingsPatch({ timer: t }).ok).toBe(true);
    }
  });
});
