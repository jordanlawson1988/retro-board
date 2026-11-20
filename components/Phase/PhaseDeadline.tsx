'use client';

import { useCallback, useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { Button, Pill } from '@/components/common';
import { useBoardStore } from '@/stores/boardStore';
import { usePhaseStore } from '@/stores/phaseStore';
import { DEADLINE_MAX_DAYS, PHASES, type PhaseId } from '@/lib/constants/phases';
import { deadlineState, nextStep, formatDeadlineDay, formatDeadlineTime } from '@/lib/phases';

/** setTimeout cannot wait longer than about 24.8 days. */
const MAX_TIMEOUT_MS = 6 * 3_600_000;

/** `datetime-local` wants `YYYY-MM-DDTHH:mm` in local time. */
function toLocalInput(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PhaseDeadline({ isFacilitator }: { isFacilitator: boolean }) {
  const board = useBoardStore((s) => s.board);
  const movePhase = usePhaseStore((s) => s.movePhase);
  const setDeadline = usePhaseStore((s) => s.setDeadline);
  const moving = usePhaseStore((s) => s.moving);
  const [now, setNow] = useState(() => Date.now());
  // The open form belongs to the phase it was opened in, and its input limits are fixed when it opens.
  const [form, setForm] = useState<{ phase: PhaseId; min: string; max: string } | null>(null);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);

  const deadline = board?.phase_config?.deadline ?? null;
  const formOpen = form !== null && form.phase === (board?.phase ?? null);

  // Re-check when the deadline falls due, so the chip turns into the banner without a reload.
  // Waits at most MAX_TIMEOUT_MS per step and does nothing once the deadline has passed.
  useEffect(() => {
    if (!deadline) return;
    const due = Date.parse(deadline);
    if (Number.isNaN(due) || now >= due) return;
    const wait = Math.max(0, Math.min(due - Date.now() + 50, MAX_TIMEOUT_MS));
    const t = setTimeout(() => setNow(Date.now()), wait);
    return () => clearTimeout(t);
  }, [deadline, now]);

  const closeForm = useCallback(() => {
    setForm(null);
    setValue('');
  }, []);

  useEffect(() => {
    if (!formOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeForm();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [formOpen, closeForm]);

  if (!board || board.mode !== 'guided' || !board.phase) return null;
  const phase = board.phase;
  const next = nextStep(phase);
  // Nothing is timed once the retro is done.
  if (!next) return null;

  const label = PHASES[phase].label;
  const state = deadlineState(deadline, now);
  const dueMs = deadline ? Date.parse(deadline) : NaN;

  const toggleForm = () => {
    if (formOpen) return closeForm();
    const opened = Date.now();
    setValue('');
    setForm({
      phase,
      min: toLocalInput(opened),
      max: toLocalInput(opened + DEADLINE_MAX_DAYS * 86_400_000),
    });
  };

  // A failed save keeps the form open; the connection banner already shows the reason.
  const submit = (iso: string | null) => {
    setBusy(true);
    setDeadline(iso)
      .then(closeForm)
      .catch(() => {})
      .finally(() => setBusy(false));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {state === 'open' && (
        <Pill variant="default" className="gap-1.5 text-[13px] text-[var(--ink-2)]">
          <Clock size={12} aria-hidden />
          {label} closes {formatDeadlineDay(dueMs)}
        </Pill>
      )}
      {state === 'passed' && (
        <p
          role="status"
          className="rounded-[var(--r-md)] border border-[var(--line-strong)] bg-[var(--surface-muted)] px-2.5 py-1 text-[13px] text-[var(--ink)]"
        >
          {label} closed at {formatDeadlineTime(dueMs)}. Waiting for the facilitator.
        </p>
      )}

      {isFacilitator && state === 'passed' && (
        <>
          {next.kind === 'move' && (
            <Button
              variant="accent"
              size="sm"
              disabled={moving}
              onClick={() => movePhase('next').catch(() => {})}
            >
              Next: {next.label}
            </Button>
          )}
          <Button variant="default" size="sm" onClick={toggleForm} aria-expanded={formOpen}>
            Extend
          </Button>
        </>
      )}
      {isFacilitator && state !== 'passed' && (
        <Button variant="ghost" size="sm" onClick={toggleForm} aria-expanded={formOpen}>
          Set a deadline
        </Button>
      )}

      {isFacilitator && formOpen && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const ms = new Date(value).getTime();
            if (!value || Number.isNaN(ms)) return;
            submit(new Date(value).toISOString());
          }}
        >
          <label className="sr-only" htmlFor="phase-deadline-input">
            Deadline
          </label>
          <input
            id="phase-deadline-input"
            type="datetime-local"
            required
            value={value}
            min={form?.min}
            max={form?.max}
            onChange={(e) => setValue(e.target.value)}
            className="rounded-[var(--r-sm)] border border-[var(--line-strong)] bg-[var(--surface)] px-2 py-1 text-[13px] text-[var(--ink)]"
          />
          <Button type="submit" variant="accent" size="sm" disabled={busy || !value}>
            Save
          </Button>
          <Button type="button" variant="default" size="sm" disabled={busy} onClick={() => submit(null)}>
            Clear
          </Button>
        </form>
      )}
    </div>
  );
}
