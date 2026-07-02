'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw, X, ChevronUp, Clock } from 'lucide-react';
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
  const [dismissed, setDismissed] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  const isRunning = timer.status === 'running';
  const isPaused  = timer.status === 'paused';
  const isExpired = timer.status === 'expired';
  const isActive  = isRunning || isPaused || isExpired;

  // Auto-expand when timer becomes active; clear dismissal
  useEffect(() => {
    if (isActive) {
      setExpanded(true);
      setDismissed(false);
    }
  }, [isActive]);

  // Close panel on outside click when idle
  useEffect(() => {
    if (!expanded) return;
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        if (!isActive) setExpanded(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [expanded, isActive]);

  // Escape to close when idle
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

  const handleDismiss = () => {
    setDismissed(true);
    setExpanded(false);
  };

  // Non-admin only sees timer when active; admins always see it
  if (!isAdmin && !isActive) return null;
  // Dismissed by user (only possible when idle — active timers can't be dismissed)
  if (dismissed && !isActive) return null;

  // ── Collapsed state: compact floating capsule ─────────────────
  if (!expanded) {
    return (
      <div className="fixed bottom-6 right-6 z-50 max-md:left-6 max-md:right-auto max-md:bottom-[calc(84px+var(--safe-bottom))] max-md:z-30">
        <button
          onClick={() => setExpanded(true)}
          className={cn(
            'inline-flex items-center gap-2.5 px-3.5 py-2 rounded-full',
            'border border-[var(--line)] shadow-[var(--shadow-lg)]',
            'bg-[var(--bg-elev)] text-[var(--ink)]',
            'transition-[box-shadow,background-color] duration-150 hover:shadow-[var(--shadow-md)] active:translate-y-px',
            isExpired && 'animate-pulse border-[var(--danger)] text-[var(--danger)]'
          )}
          title={isActive ? `Timer: ${formatTime(timer.remaining)}` : 'Open timer'}
          aria-label={isActive ? `Timer: ${formatTime(timer.remaining)} — click to expand` : 'Open timer'}
        >
          <Clock size={15} className={cn('text-[var(--ink-3)]', isExpired && 'text-[var(--danger)]')} />
          {isActive && (
            <span className={cn(
              'font-mono tabular-nums text-[14px]',
              isExpired ? 'text-[var(--danger)]' : 'text-[var(--ink)]'
            )}>
              {isExpired ? "Time's up!" : formatTime(timer.remaining)}
            </span>
          )}
          {!isActive && (
            <span className="text-[13px] text-[var(--ink-3)]">Timer</span>
          )}
        </button>
      </div>
    );
  }

  // ── Expanded state: floating capsule panel ───────────────────
  return (
    <div className="fixed bottom-6 right-6 z-50 max-md:left-6 max-md:right-auto max-md:bottom-[calc(84px+var(--safe-bottom))] max-md:z-30" ref={panelRef}>
      <div className={cn(
        'w-72 rounded-[var(--r-2xl)] border border-[var(--line)] shadow-[var(--shadow-lg)]',
        'bg-[var(--bg-elev)] overflow-hidden'
      )}>
        {/* Header row — capsule style */}
        <div className={cn(
          'flex items-center justify-between px-4 py-3',
          isExpired
            ? 'bg-[color-mix(in_oklab,var(--danger)_12%,transparent)]'
            : isActive
            ? 'bg-[color-mix(in_oklab,var(--accent)_10%,transparent)]'
            : 'bg-[var(--surface-muted)]'
        )}>
          <div className="flex items-center gap-2">
            <Clock size={15} className="text-[var(--ink-4)]" />
            <span className="text-[13px] font-semibold text-[var(--ink)]">Timer</span>
          </div>
          <div className="flex items-center gap-1">
            {/* Dismiss (idle only) */}
            {!isActive && (
              <button
                onClick={handleDismiss}
                className="rounded-full p-1.5 text-[var(--ink-4)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink-2)] transition-colors duration-120"
                aria-label="Dismiss timer"
              >
                <X size={14} />
              </button>
            )}
            {/* Minimize / collapse */}
            <button
              onClick={() => setExpanded(false)}
              className="rounded-full p-1.5 text-[var(--ink-4)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink-2)] transition-colors duration-120"
              aria-label="Minimize timer"
            >
              <ChevronUp size={14} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4">
          {isActive || isExpired ? (
            /* ── Active / expired ── */
            <div className="flex flex-col items-center gap-4">
              {isExpired ? (
                <span className="text-2xl font-bold text-[var(--danger)] animate-pulse">
                  Time&apos;s up!
                </span>
              ) : (
                <span
                  className="text-4xl font-mono font-bold tabular-nums"
                  style={{
                    color: isPaused
                      ? 'var(--ink-3)'
                      : timer.remaining <= 10
                      ? 'var(--danger)'
                      : 'var(--ink)',
                  }}
                >
                  {formatTime(timer.remaining)}
                </span>
              )}

              {/* Admin controls */}
              {isAdmin && (
                <div className="flex items-center gap-2">
                  {isRunning && (
                    <button
                      onClick={onPause}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px]',
                        'border border-[var(--line)] text-[var(--ink-2)]',
                        'hover:bg-[var(--surface-muted)] transition-colors duration-120'
                      )}
                    >
                      <Pause size={13} />
                      Pause
                    </button>
                  )}
                  {isPaused && (
                    <button
                      onClick={onResume}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px]',
                        'bg-[var(--accent)] text-[var(--on-accent)]',
                        'hover:opacity-90 transition-opacity duration-120'
                      )}
                    >
                      <Play size={13} />
                      Resume
                    </button>
                  )}
                  <button
                    onClick={handleReset}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px]',
                      'border border-[var(--line)] text-[var(--ink-2)]',
                      'hover:bg-[var(--surface-muted)] transition-colors duration-120'
                    )}
                  >
                    <RotateCcw size={13} />
                    Reset
                  </button>
                </div>
              )}

              {/* Thin divider + caption */}
              <div className="flex items-center gap-2 w-full px-1">
                <span className="flex-1 h-px bg-[var(--line)]" />
                <span className="text-[11px] text-[var(--ink-4)]">
                  {isExpired ? 'session ended' : isRunning ? 'running' : 'paused'}
                </span>
                <span className="flex-1 h-px bg-[var(--line)]" />
              </div>
            </div>
          ) : (
            /* ── Idle (admin presets + custom) ── */
            <>
              <p className="mb-3 text-[11px] font-medium text-[var(--ink-4)] uppercase tracking-wide">
                Quick start
              </p>
              <div className="mb-4 flex flex-wrap gap-2">
                {TIMER_PRESETS.map((preset) => (
                  <button
                    key={preset.seconds}
                    onClick={() => handlePresetClick(preset.seconds)}
                    className={cn(
                      'rounded-full border border-[var(--line)] px-3 py-1.5 text-[13px] text-[var(--ink-2)]',
                      'hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--on-accent)]',
                      'transition-[background-color,color,border-color] duration-120'
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="border-t border-[var(--line)] pt-3">
                <p className="mb-2 text-[11px] font-medium text-[var(--ink-4)] uppercase tracking-wide">
                  Custom
                </p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleStartCustom()}
                    placeholder="Minutes"
                    className={cn(
                      'flex-1 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)]',
                      'px-3 py-2 text-base sm:text-[13px] text-[var(--ink)]',
                      'placeholder:text-[var(--ink-4)] outline-none',
                      'focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-soft)]',
                      'transition-[border-color,box-shadow] duration-150'
                    )}
                  />
                  <button
                    onClick={handleStartCustom}
                    disabled={!customMinutes || parseFloat(customMinutes) <= 0 || parseFloat(customMinutes) > 60}
                    className={cn(
                      'rounded-[var(--r-md)] px-4 py-2 text-[13px]',
                      'bg-[var(--accent)] text-[var(--on-accent)]',
                      'transition-opacity duration-120 hover:opacity-90',
                      'disabled:cursor-not-allowed disabled:opacity-40'
                    )}
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
