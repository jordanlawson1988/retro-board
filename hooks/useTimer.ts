'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useChannel } from 'ably/react';
import { playTimerDing, resumeAudioContext } from '@/lib/audio';
import type { TimerState } from '@/types';

const IDLE_TIMER: TimerState = { duration: 0, remaining: 0, status: 'idle', started_at: null };

interface UseTimerOptions {
  boardId: string;
  liveSync?: boolean;
}

export function useTimer({ boardId, liveSync = true }: UseTimerOptions) {
  const [timer, setTimer] = useState<TimerState>(IDLE_TIMER);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<TimerState>(IDLE_TIMER);

  useEffect(() => {
    timerRef.current = timer;
  }, [timer]);

  const clearTick = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startCountdown = useCallback((startedAt: string, duration: number) => {
    clearTick();
    intervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
      const remaining = Math.max(0, duration - elapsed);
      if (remaining <= 0) {
        clearTick();
        setTimer({ duration, remaining: 0, status: 'expired', started_at: startedAt });
        playTimerDing();
      } else {
        setTimer({ duration, remaining, status: 'running', started_at: startedAt });
      }
    }, 250);
  }, [clearTick]);

  // Ably channel for timer events
  const { channel } = useChannel(
    {
      channelName: `retro-board:${boardId}:timer`,
      skip: !liveSync,
    },
    (message) => {
      const { name, data } = message;

      if (name === 'timer:start' || name === 'timer:resume' || name === 'timer:sync-response') {
        const state = data as TimerState;
        resumeAudioContext();
        setTimer(state);
        if (state.started_at && state.status === 'running') {
          startCountdown(state.started_at, state.duration);
        }
      } else if (name === 'timer:pause') {
        clearTick();
        setTimer(data as TimerState);
      } else if (name === 'timer:reset') {
        clearTick();
        setTimer(IDLE_TIMER);
      } else if (name === 'timer:sync-request') {
        channel?.publish('timer:sync-response', timerRef.current);
      }
    }
  );

  // Request sync on mount
  useEffect(() => {
    if (!liveSync || !channel) return;
    channel.publish('timer:sync-request', {});
  }, [liveSync, channel]);

  const start = useCallback((duration: number) => {
    resumeAudioContext();
    const startedAt = new Date().toISOString();
    const state: TimerState = { duration, remaining: duration, status: 'running', started_at: startedAt };
    setTimer(state);
    startCountdown(startedAt, duration);
    channel?.publish('timer:start', state);
  }, [startCountdown, channel]);

  const pause = useCallback(() => {
    clearTick();
    const paused: TimerState = { ...timerRef.current, status: 'paused' };
    setTimer(paused);
    channel?.publish('timer:pause', paused);
  }, [clearTick, channel]);

  const resume = useCallback(() => {
    resumeAudioContext();
    const prev = timerRef.current;
    const startedAt = new Date(Date.now() - (prev.duration - prev.remaining) * 1000).toISOString();
    const resumed: TimerState = { ...prev, status: 'running', started_at: startedAt };
    setTimer(resumed);
    startCountdown(startedAt, prev.duration);
    channel?.publish('timer:resume', resumed);
  }, [startCountdown, channel]);

  const reset = useCallback(() => {
    clearTick();
    setTimer(IDLE_TIMER);
    channel?.publish('timer:reset', IDLE_TIMER);
  }, [clearTick, channel]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { timer, start, pause, resume, reset };
}
