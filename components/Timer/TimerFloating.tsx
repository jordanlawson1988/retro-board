'use client';

import { useState, useRef, useEffect } from 'react';
import { Clock, Play, Pause, RotateCcw, X, ChevronUp } from 'lucide-react';
import { cn } from '@/utils/cn';
import { TIMER_PRESETS } from '@/utils/constants';
import type { TimerState } from '@/types';

interface TimerFloatingProps {
  timer: TimerState;
  isAdmin: boolean;
  onStart: (duration: number) => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function TimerFloating({ timer, isAdmin, onStart, onPause, onResume, onReset }: TimerFloatingProps) {
  const [expanded, setExpanded] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  const isRunning = timer.status === 'running';
  const isPaused = timer.status === 'paused';
  const isExpired = timer.status === 'expired';
  const isActive = isRunning || isPaused || isExpired;

  // Auto-expand when timer starts
  useEffect(() => {
    if (isActive) setExpanded(true);
  }, [isActive]);

  // Close on outside click
  useEffect(() => {
    if (!expanded) return;
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        // Only collapse if timer is idle (don't hide active timer)
        if (!isActive) setExpanded(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [expanded, isActive]);

  // Close on Escape
  useEffect(() => {
    if (!expanded) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isActive) setExpanded(false);
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [expanded, isActive]);

  const handlePresetClick = (seconds: number) => {
    onStart(seconds);
  };

  const handleStartCustom = () => {
    const mins = parseFloat(customMinutes);
    if (mins > 0 && mins <= 60) {
      onStart(mins * 60);
      setCustomMinutes('');
    }
  };

  const handleReset = () => {
    onReset();
    setExpanded(false);
  };

  // Non-admin users only see the timer when it's active
  if (!isAdmin && !isActive) return null;

  // Collapsed state: small floating button (admin only when idle, or minimized pill when active)
  if (!expanded) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setExpanded(true)}
          className={cn(
            'flex items-center gap-2 rounded-full px-4 py-3 shadow-lg transition-all hover:scale-105',
            isActive
              ? isExpired
                ? 'bg-[var(--color-error)] text-white animate-pulse'
                : isRunning
                  ? 'bg-[var(--color-navy)] text-white'
                  : 'bg-[var(--color-gray-6)] text-white'
              : 'bg-[var(--color-navy)] text-white'
          )}
          title={isActive ? `Timer: ${formatTime(timer.remaining)}` : 'Open timer'}
        >
          <Clock size={18} />
          {isActive && (
            <span className="font-mono font-semibold tabular-nums">
              {isExpired ? "Time's up!" : formatTime(timer.remaining)}
            </span>
          )}
        </button>
      </div>
    );
  }

  // Expanded state: floating panel
  return (
    <div className="fixed bottom-6 right-6 z-50" ref={panelRef}>
      <div className="w-72 rounded-xl border border-[var(--color-gray-2)] bg-[var(--color-surface)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className={cn(
          'flex items-center justify-between px-4 py-3',
          isExpired
            ? 'bg-[var(--color-error)] text-white'
            : isActive
              ? 'bg-[var(--color-navy)] text-white'
              : 'bg-[var(--color-gray-0)] text-[var(--color-gray-7)]'
        )}>
          <div className="flex items-center gap-2">
            <Clock size={16} />
            <span className="text-sm font-semibold">Timer</span>
          </div>
          <button
            onClick={() => setExpanded(false)}
            className="rounded-md p-1 transition-colors hover:bg-white/20"
            title="Minimize"
          >
            {isActive ? <ChevronUp size={16} /> : <X size={16} />}
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          {isActive || isExpired ? (
            /* Active / expired state */
            <div className="flex flex-col items-center gap-4">
              {/* Countdown */}
              {isExpired ? (
                <span className="text-2xl font-bold text-[var(--color-error)] animate-pulse">
                  Time&apos;s up!
                </span>
              ) : (
                <span
                  className="text-4xl font-mono font-bold tabular-nums"
                  style={{
                    color: isPaused
                      ? 'var(--color-gray-5)'
                      : timer.remaining <= 10
                        ? 'var(--color-error)'
                        : 'var(--color-navy)',
                  }}
                >
                  {formatTime(timer.remaining)}
                </span>
              )}

              {/* Controls — admin only */}
              {isAdmin && (
                <div className="flex items-center gap-2">
                  {isRunning && (
                    <button
                      onClick={onPause}
                      className="flex items-center gap-1.5 rounded-lg border border-[var(--color-gray-2)] px-4 py-2 text-sm hover:bg-[var(--color-gray-1)] transition-colors"
                      title="Pause"
                    >
                      <Pause size={14} />
                      Pause
                    </button>
                  )}
                  {isPaused && (
                    <button
                      onClick={onResume}
                      className="flex items-center gap-1.5 rounded-lg bg-[var(--color-navy)] px-4 py-2 text-sm text-white hover:opacity-90 transition-opacity"
                      title="Resume"
                    >
                      <Play size={14} />
                      Resume
                    </button>
                  )}
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-1.5 rounded-lg border border-[var(--color-gray-2)] px-4 py-2 text-sm hover:bg-[var(--color-gray-1)] transition-colors"
                    title="Reset"
                  >
                    <RotateCcw size={14} />
                    Reset
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Idle state — admin presets + custom (non-admins never see this) */
            <>
              <p className="mb-3 text-xs font-medium text-[var(--color-gray-5)] uppercase tracking-wide">Quick start</p>
              <div className="mb-4 flex flex-wrap gap-2">
                {TIMER_PRESETS.map((preset) => (
                  <button
                    key={preset.seconds}
                    onClick={() => handlePresetClick(preset.seconds)}
                    className="rounded-full border border-[var(--color-gray-2)] px-3 py-1.5 text-sm transition-colors hover:border-[var(--color-navy)] hover:bg-[var(--color-navy)] hover:text-white"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="border-t border-[var(--color-gray-1)] pt-3">
                <p className="mb-2 text-xs font-medium text-[var(--color-gray-5)] uppercase tracking-wide">Custom</p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleStartCustom()}
                    placeholder="Minutes"
                    className="flex-1 rounded-lg border border-[var(--color-gray-2)] px-3 py-2 text-base sm:text-sm focus:border-[var(--color-navy)] focus:outline-none"
                  />
                  <button
                    onClick={handleStartCustom}
                    disabled={!customMinutes || parseFloat(customMinutes) <= 0 || parseFloat(customMinutes) > 60}
                    className="rounded-lg bg-[var(--color-navy)] px-4 py-2 text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Start
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
