'use client';

import { useState, useRef, useEffect } from 'react';
import { Clock, Play, Pause, RotateCcw } from 'lucide-react';
import { cn } from '@/utils/cn';
import { TIMER_PRESETS } from '@/utils/constants';
import type { TimerState } from '@/types';

interface TimerControlsProps {
  timer: TimerState;
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

export function TimerControls({ timer, onStart, onPause, onResume, onReset }: TimerControlsProps) {
  const [open, setOpen] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const hasBeenOpen = useRef(false);

  const isRunning = timer.status === 'running';
  const isPaused = timer.status === 'paused';
  const isExpired = timer.status === 'expired';
  const isActive = isRunning || isPaused;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open]);

  // Focus management: move focus into popover on open, return to trigger on close
  useEffect(() => {
    if (open) {
      hasBeenOpen.current = true;
      requestAnimationFrame(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const focusable = dialog.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        (focusable ?? dialog)?.focus();
      });
    } else if (hasBeenOpen.current) {
      triggerRef.current?.focus();
    }
  }, [open]);

  const handlePresetClick = (seconds: number) => {
    onStart(seconds);
    setOpen(false);
  };

  const handleStartCustom = () => {
    const mins = parseFloat(customMinutes);
    if (mins > 0 && mins <= 60) {
      onStart(mins * 60);
      setCustomMinutes('');
      setOpen(false);
    }
  };

  const handleReset = () => {
    onReset();
  };

  // Determine trigger button style based on timer state
  const triggerActive = isActive || isExpired;
  const triggerClassName = cn(
    'flex items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-md)] px-2.5 py-1.5 text-sm transition-colors',
    isRunning && 'bg-[var(--color-navy)]/10 text-[var(--color-navy)] font-medium',
    isPaused && 'bg-[var(--color-gray-1)] text-[var(--color-gray-6)] font-medium',
    isExpired && 'bg-[var(--color-error)]/10 text-[var(--color-error)] font-medium animate-pulse',
    !triggerActive && 'text-[var(--color-gray-5)] hover:bg-[var(--color-gray-1)] hover:text-[var(--color-gray-7)]'
  );

  return (
    <div className="relative" ref={popoverRef}>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className={triggerClassName}
        title="Timer"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Clock size={14} />
        <span className="hidden sm:inline">Timer</span>
      </button>

      {/* Popover */}
      {open && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-label="Timer controls"
          tabIndex={-1}
          className="absolute right-0 top-full mt-2 w-60 rounded-lg border border-[var(--color-gray-2)] bg-[var(--color-surface)] p-3 shadow-lg z-50"
        >
          {isActive || isExpired ? (
            /* Active / expired state */
            <div className="flex flex-col items-center gap-3">
              {/* Countdown or expired message */}
              {isExpired ? (
                <span className="text-lg font-semibold text-[var(--color-error)] animate-pulse">
                  Time&apos;s up!
                </span>
              ) : (
                <span
                  className="text-2xl font-mono font-bold tabular-nums"
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

              {/* Controls */}
              <div className="flex items-center gap-2">
                {isRunning && (
                  <button
                    onClick={onPause}
                    className="flex items-center gap-1 rounded-md border border-[var(--color-gray-2)] px-3 py-1.5 text-xs hover:bg-[var(--color-gray-1)] transition-colors"
                    title="Pause"
                  >
                    <Pause size={12} />
                    Pause
                  </button>
                )}
                {isPaused && (
                  <button
                    onClick={onResume}
                    className="flex items-center gap-1 rounded-md bg-[var(--color-navy)] px-3 py-1.5 text-xs text-white hover:opacity-90 transition-opacity"
                    title="Resume"
                  >
                    <Play size={12} />
                    Resume
                  </button>
                )}
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1 rounded-md border border-[var(--color-gray-2)] px-3 py-1.5 text-xs hover:bg-[var(--color-gray-1)] transition-colors"
                  title="Reset"
                >
                  <RotateCcw size={12} />
                  Reset
                </button>
              </div>

              {/* New timer link */}
              <div className="w-full border-t border-[var(--color-gray-1)] pt-2 text-center">
                <button
                  onClick={handleReset}
                  className="text-xs text-[var(--color-navy)] hover:underline"
                >
                  New timer
                </button>
              </div>
            </div>
          ) : (
            /* Idle state — presets + custom */
            <>
              <p className="mb-2 text-xs font-medium text-[var(--color-gray-5)]">Quick start</p>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {TIMER_PRESETS.map((preset) => (
                  <button
                    key={preset.seconds}
                    onClick={() => handlePresetClick(preset.seconds)}
                    className="rounded-full border border-[var(--color-gray-2)] px-2.5 py-1 text-xs transition-colors hover:border-[var(--color-navy)] hover:bg-[var(--color-navy)] hover:text-white"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="border-t border-[var(--color-gray-1)] pt-2">
                <p className="mb-1.5 text-xs font-medium text-[var(--color-gray-5)]">Custom</p>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleStartCustom()}
                    placeholder="Minutes"
                    className="flex-1 rounded-md border border-[var(--color-gray-2)] px-2 py-1.5 text-base sm:text-xs focus:border-[var(--color-navy)] focus:outline-none"
                  />
                  <button
                    onClick={handleStartCustom}
                    disabled={!customMinutes || parseFloat(customMinutes) <= 0 || parseFloat(customMinutes) > 60}
                    className="rounded-md bg-[var(--color-navy)] px-3 py-1 text-xs text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Start
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
