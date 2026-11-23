'use client';

import { useEffect, useRef, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Button, Input } from '@/components/common';
import { cn } from '@/utils/cn';
import { useBoardStore } from '@/stores/boardStore';
import { MAX_VOTES_PER_CARD_RANGE, MAX_VOTES_PER_PARTICIPANT_RANGE } from '@/lib/constants/board-settings';
import type { PhaseId } from '@/lib/constants/phases';
import { maxVotesPerCard, voteLimitProblem, voteLimitsEditable } from '@/lib/votes';
import type { BoardSettings } from '@/types';

interface VoteLimitsProps {
  /** 'inline' sits in the desktop phase row; 'stacked' fills the width of the mobile More sheet. */
  layout?: 'inline' | 'stacked';
}

/**
 * The facilitator's two vote limits. Mounted for facilitators only, and shown only while a change
 * still has an effect (`voteLimitsEditable`). The open form belongs to the phase it was opened in.
 */
export function VoteLimits({ layout = 'inline' }: VoteLimitsProps) {
  const board = useBoardStore((s) => s.board);
  const updateSettings = useBoardStore((s) => s.updateSettings);
  const clearWriteError = useBoardStore((s) => s.clearWriteError);
  const [form, setForm] = useState<{ phase: PhaseId; person: string; card: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstRef = useRef<HTMLInputElement>(null);
  const stacked = layout === 'stacked';

  const formOpen = form !== null && form.phase === (board?.phase ?? null) && voteLimitsEditable(board);

  // A form left behind by a phase change must not come back when that phase is reached again.
  if (form !== null && !formOpen) setForm(null);

  useEffect(() => {
    if (formOpen) firstRef.current?.focus();
  }, [formOpen]);

  if (!board || !voteLimitsEditable(board) || !board.phase) return null;
  const phase = board.phase;
  const settings = board.settings;

  const close = (returnFocus: boolean) => {
    setForm(null);
    setProblem(null);
    if (returnFocus) triggerRef.current?.focus();
  };

  const toggle = () => {
    if (formOpen) return close(false);
    setProblem(null);
    setForm({
      phase,
      person: String(settings.max_votes_per_participant),
      card: String(maxVotesPerCard(settings)),
    });
  };

  const person = Number(form?.person);
  const cardMax = Math.min(
    MAX_VOTES_PER_CARD_RANGE.max,
    Number.isInteger(person) && person >= MAX_VOTES_PER_PARTICIPANT_RANGE.min ? person : MAX_VOTES_PER_CARD_RANGE.max,
  );

  const save = () => {
    // Not disabled while it runs: a disabled button would drop keyboard focus out of the form.
    if (!form || busy) return;
    const patch: Partial<BoardSettings> = {};
    const nextPerson = Number(form.person);
    const nextCard = Number(form.card);
    if (nextPerson !== settings.max_votes_per_participant) patch.max_votes_per_participant = nextPerson;
    if (nextCard !== maxVotesPerCard(settings)) patch.max_votes_per_card = nextCard;
    if (Object.keys(patch).length === 0) return close(true);
    const blocked = voteLimitProblem(settings, patch);
    if (blocked) return setProblem(blocked);
    setProblem(null);
    setBusy(true);
    // A rejection leaves the form open with what was typed, and shows the server's reason here, so
    // the connection banner's copy of the same message is cleared rather than shown twice.
    updateSettings(patch)
      .then(() => close(true))
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e);
        // Only this form's own error: another write's banner message stays.
        if (useBoardStore.getState().lastWriteError === message) clearWriteError();
        setProblem(message);
      })
      .finally(() => setBusy(false));
  };

  const message = problem && (
    <p role="alert" className="basis-full text-sm text-[var(--danger)]">
      {problem}
    </p>
  );

  return (
    <div className={cn(stacked ? 'flex flex-col gap-2' : 'flex flex-wrap items-start gap-2')}>
      <Button
        ref={triggerRef}
        variant={stacked ? 'default' : 'ghost'}
        size={stacked ? 'md' : 'sm'}
        aria-expanded={formOpen}
        onClick={toggle}
        className={cn(stacked && 'min-h-11 w-full justify-start')}
      >
        <SlidersHorizontal size={stacked ? 16 : 12} aria-hidden />
        Vote limits
      </Button>

      {formOpen && form && (
        <form
          className={cn(stacked ? 'flex flex-col gap-3' : 'flex flex-wrap items-start gap-3')}
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Escape') return;
            e.stopPropagation();
            close(true);
          }}
        >
          <Input
            ref={firstRef}
            id={`vote-limit-person-${layout}`}
            label="Votes per person"
            type="number"
            inputMode="numeric"
            required
            step={1}
            min={MAX_VOTES_PER_PARTICIPANT_RANGE.min}
            max={MAX_VOTES_PER_PARTICIPANT_RANGE.max}
            value={form.person}
            onChange={(e) => setForm({ ...form, person: e.target.value })}
            className={cn(!stacked && 'w-24')}
          />
          <Input
            id={`vote-limit-card-${layout}`}
            label="Votes per card"
            type="number"
            inputMode="numeric"
            required
            step={1}
            min={MAX_VOTES_PER_CARD_RANGE.min}
            max={cardMax}
            value={form.card}
            onChange={(e) => setForm({ ...form, card: e.target.value })}
            className={cn(!stacked && 'w-24')}
          />
          {stacked && message}
          <div className={cn('flex items-center gap-2', !stacked && 'self-end')}>
            <Button type="submit" variant="accent" size={stacked ? 'md' : 'sm'} aria-busy={busy} className={cn(stacked && 'min-h-11 flex-1')}>
              Save
            </Button>
            <Button
              type="button"
              variant="default"
              size={stacked ? 'md' : 'sm'}
              onClick={() => close(true)}
              className={cn(stacked && 'min-h-11 flex-1')}
            >
              Cancel
            </Button>
          </div>
          {!stacked && message}
        </form>
      )}
    </div>
  );
}
