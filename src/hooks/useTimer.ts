import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
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
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timerRef = useRef<TimerState>(IDLE_TIMER);

  // Keep ref in sync with state
  useEffect(() => {
    timerRef.current = timer;
  }, [timer]);

  // Cleanup interval
  const clearTick = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Start local countdown
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

  // Broadcast actions
  const broadcastEvent = useCallback((event: string, payload: Partial<TimerState>) => {
    if (!liveSync) return;
    channelRef.current?.send({
      type: 'broadcast',
      event,
      payload,
    });
  }, [liveSync]);

  const start = useCallback((duration: number) => {
    resumeAudioContext();
    const startedAt = new Date().toISOString();
    const state: TimerState = { duration, remaining: duration, status: 'running', started_at: startedAt };
    setTimer(state);
    startCountdown(startedAt, duration);
    broadcastEvent('timer:start', state);
  }, [startCountdown, broadcastEvent]);

  const pause = useCallback(() => {
    clearTick();
    setTimer((prev) => {
      const paused: TimerState = { ...prev, status: 'paused' };
      broadcastEvent('timer:pause', paused);
      return paused;
    });
  }, [clearTick, broadcastEvent]);

  const resume = useCallback(() => {
    resumeAudioContext();
    setTimer((prev) => {
      const startedAt = new Date(Date.now() - (prev.duration - prev.remaining) * 1000).toISOString();
      const resumed: TimerState = { ...prev, status: 'running', started_at: startedAt };
      startCountdown(startedAt, prev.duration);
      broadcastEvent('timer:resume', resumed);
      return resumed;
    });
  }, [startCountdown, broadcastEvent]);

  const reset = useCallback(() => {
    clearTick();
    setTimer(IDLE_TIMER);
    broadcastEvent('timer:reset', IDLE_TIMER);
  }, [clearTick, broadcastEvent]);

  // Subscribe to broadcast channel -- stable deps only (no timer state)
  useEffect(() => {
    if (!liveSync) return;

    const channel = supabase.channel(`timer:${boardId}`);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'timer:start' }, ({ payload }) => {
        resumeAudioContext();
        const state = payload as TimerState;
        setTimer(state);
        if (state.started_at) {
          // Clear any existing interval before starting new one
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = setInterval(() => {
            const elapsed = Math.floor((Date.now() - new Date(state.started_at!).getTime()) / 1000);
            const remaining = Math.max(0, state.duration - elapsed);
            if (remaining <= 0) {
              if (intervalRef.current) clearInterval(intervalRef.current);
              intervalRef.current = null;
              setTimer({ duration: state.duration, remaining: 0, status: 'expired', started_at: state.started_at });
              playTimerDing();
            } else {
              setTimer({ duration: state.duration, remaining, status: 'running', started_at: state.started_at });
            }
          }, 250);
        }
      })
      .on('broadcast', { event: 'timer:pause' }, ({ payload }) => {
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        setTimer(payload as TimerState);
      })
      .on('broadcast', { event: 'timer:resume' }, ({ payload }) => {
        const state = payload as TimerState;
        resumeAudioContext();
        setTimer(state);
        if (state.started_at) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = setInterval(() => {
            const elapsed = Math.floor((Date.now() - new Date(state.started_at!).getTime()) / 1000);
            const remaining = Math.max(0, state.duration - elapsed);
            if (remaining <= 0) {
              if (intervalRef.current) clearInterval(intervalRef.current);
              intervalRef.current = null;
              setTimer({ duration: state.duration, remaining: 0, status: 'expired', started_at: state.started_at });
              playTimerDing();
            } else {
              setTimer({ duration: state.duration, remaining, status: 'running', started_at: state.started_at });
            }
          }, 250);
        }
      })
      .on('broadcast', { event: 'timer:reset' }, () => {
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        setTimer(IDLE_TIMER);
      })
      .on('broadcast', { event: 'timer:sync-request' }, () => {
        // Respond with current timer state from ref (avoids stale closure)
        broadcastEvent('timer:sync-response', timerRef.current);
      })
      .on('broadcast', { event: 'timer:sync-response' }, ({ payload }) => {
        const state = payload as TimerState;
        setTimer(state);
        if (state.status === 'running' && state.started_at) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = setInterval(() => {
            const elapsed = Math.floor((Date.now() - new Date(state.started_at!).getTime()) / 1000);
            const remaining = Math.max(0, state.duration - elapsed);
            if (remaining <= 0) {
              if (intervalRef.current) clearInterval(intervalRef.current);
              intervalRef.current = null;
              setTimer({ duration: state.duration, remaining: 0, status: 'expired', started_at: state.started_at });
              playTimerDing();
            } else {
              setTimer({ duration: state.duration, remaining, status: 'running', started_at: state.started_at });
            }
          }, 250);
        }
      })
      .subscribe(() => {
        // Request sync on join
        channel.send({ type: 'broadcast', event: 'timer:sync-request', payload: {} });
      });

    return () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      supabase.removeChannel(channel);
    };
  }, [boardId, liveSync, broadcastEvent]);

  return { timer, start, pause, resume, reset };
}
