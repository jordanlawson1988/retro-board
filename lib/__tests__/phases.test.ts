import { describe, it, expect } from 'vitest';
import { PHASE_IDS, PHASES } from '@/lib/constants/phases';
import {
  resolvePhaseMove,
  phaseSettings,
  PHASE_OWNED_SETTINGS,
  phaseDenial,
  validateDeadline,
  readySummary,
  uiGates,
  applyPhaseChanged,
  nextStep,
  formatDeadlineDay,
  formatDeadlineTime,
} from '@/lib/phases';
import { DEFAULT_BOARD_SETTINGS } from '@/utils/constants';

describe('resolvePhaseMove', () => {
  it('next walks reflect > group > vote > discuss', () => {
    expect(resolvePhaseMove('reflect', 'next')).toEqual({ ok: true, phase: 'group' });
    expect(resolvePhaseMove('vote', 'next')).toEqual({ ok: true, phase: 'discuss' });
  });
  it('never moves into done; completing does that', () => {
    expect(resolvePhaseMove('discuss', 'next')).toEqual({ ok: false, error: 'Complete the retro to finish' });
    expect(resolvePhaseMove('vote', 'done')).toEqual({ ok: false, error: 'Complete the retro to finish' });
  });
  it('refuses back from the first phase, any move from done, and a move to the same phase', () => {
    expect(resolvePhaseMove('reflect', 'back')).toEqual({ ok: false, error: 'Already at the first phase' });
    expect(resolvePhaseMove('done', 'back')).toEqual({ ok: false, error: 'The retro is completed' });
    expect(resolvePhaseMove('group', 'group')).toEqual({ ok: false, error: 'Already in that phase' });
  });
  it('allows a named jump backwards and forwards', () => {
    expect(resolvePhaseMove('discuss', 'group')).toEqual({ ok: true, phase: 'group' });
    expect(resolvePhaseMove('reflect', 'vote')).toEqual({ ok: true, phase: 'vote' });
  });
});

describe('phaseSettings', () => {
  it('reflect hides text and closes voting', () => {
    expect(phaseSettings('reflect')).toMatchObject({
      card_visibility: 'hidden', voting_enabled: false, secret_voting: true,
      card_creation_disabled: false, board_locked: false,
    });
  });
  it('vote keeps totals secret; discuss shows them (Review Focus 4)', () => {
    expect(phaseSettings('vote')).toMatchObject({ voting_enabled: true, secret_voting: true, card_visibility: 'visible' });
    expect(phaseSettings('discuss')).toMatchObject({ voting_enabled: false, secret_voting: false });
  });
  it('done locks the board and every phase resets the timer to idle', () => {
    expect(phaseSettings('done').board_locked).toBe(true);
    for (const id of PHASE_IDS) expect(phaseSettings(id).timer).toEqual({ duration: 0, remaining: 0, status: 'idle', started_at: null });
  });
  it('returns exactly the phase-owned keys plus timer', () => {
    expect(Object.keys(phaseSettings('group')).sort()).toEqual([...PHASE_OWNED_SETTINGS, 'timer'].sort());
  });
});

describe('phaseDenial', () => {
  it.each([
    ['card.create', 'group'], ['card.edit', 'vote'], ['card.delete', 'discuss'],
    ['card.move', 'reflect'], ['card.move', 'vote'], ['vote.toggle', 'reflect'], ['vote.toggle', 'discuss'],
  ] as const)('%s is denied in %s', (action, phase) => {
    expect(phaseDenial(action, phase)).toBe(`Not available during ${PHASES[phase].label}`);
  });
  it.each([
    ['card.create', 'reflect'], ['card.edit', 'group'], ['card.move', 'group'], ['vote.toggle', 'vote'],
    ['card.react', 'vote'], ['action-item.write', 'reflect'], ['board.settings', 'vote'], ['participant.leave', 'done'],
  ] as const)('%s is allowed in %s', (action, phase) => {
    expect(phaseDenial(action, phase)).toBeNull();
  });
});

describe('validateDeadline', () => {
  const now = Date.parse('2026-11-18T12:00:00Z');
  it('accepts null and a future ISO time', () => {
    expect(validateDeadline(null, now)).toEqual({ ok: true, value: null });
    expect(validateDeadline('2026-11-19T17:00:00.000Z', now)).toEqual({ ok: true, value: '2026-11-19T17:00:00.000Z' });
  });
  it('rejects garbage, the past, and more than 30 days out', () => {
    for (const v of ['soon', 42, '', '2026-11-18T11:59:00Z', '2026-12-19T12:00:01Z']) {
      expect(validateDeadline(v, now).ok).toBe(false);
    }
  });
});

describe('readySummary', () => {
  it('counts a participant with two tabs once and ignores a ready flag for another phase', () => {
    const members = [
      { clientId: 'a', data: { readyPhase: 'reflect' } },
      { clientId: 'a', data: { readyPhase: null } },
      { clientId: 'b', data: { readyPhase: 'group' } },
      { clientId: 'c', data: 'junk' },
    ];
    expect(readySummary(members, 'reflect')).toEqual({ readyIds: ['a'], total: 3 });
  });
});

describe('uiGates', () => {
  it('is fully open on an open board', () => {
    expect(uiGates('open', null)).toEqual({ addLocked: false, editLocked: false, moveLocked: false });
  });
  it('follows the profile on a guided board', () => {
    expect(uiGates('guided', 'reflect')).toEqual({ addLocked: false, editLocked: false, moveLocked: true });
    expect(uiGates('guided', 'vote')).toEqual({ addLocked: true, editLocked: true, moveLocked: true });
  });
});

describe('applyPhaseChanged', () => {
  const board = { phase: 'reflect' as const, settings: DEFAULT_BOARD_SETTINGS, phase_config: { deadline: null } };
  it('applies a well-formed payload', () => {
    const next = applyPhaseChanged(board, { phase: 'group', settings: { ...DEFAULT_BOARD_SETTINGS, card_visibility: 'visible' }, phaseConfig: { deadline: null } });
    expect(next.phase).toBe('group');
    expect(next.settings.card_visibility).toBe('visible');
  });
  it('returns the board unchanged for an unknown phase or a non-object', () => {
    expect(applyPhaseChanged(board, { phase: 'party' })).toBe(board);
    expect(applyPhaseChanged(board, null)).toBe(board);
  });
});

describe('nextStep', () => {
  it('reflect, group and vote give the next phase with its label', () => {
    expect(nextStep('reflect')).toEqual({ kind: 'move', label: PHASES.group.label });
    expect(nextStep('group')).toEqual({ kind: 'move', label: PHASES.vote.label });
    expect(nextStep('vote')).toEqual({ kind: 'move', label: PHASES.discuss.label });
  });
  it('discuss, the last phase before done, gives complete', () => {
    expect(nextStep('discuss')).toEqual({ kind: 'complete' });
  });
  it('done gives null: the rail renders no forward button', () => {
    expect(nextStep('done')).toBeNull();
  });
  it('covers every phase id', () => {
    for (const id of PHASE_IDS) expect(nextStep(id) === null).toBe(id === 'done');
  });
});

describe('deadline formatting', () => {
  // Friday 2026-11-20 20:30 UTC
  const ms = Date.UTC(2026, 10, 20, 20, 30);
  it('chip day and time are weekday, space, time with no comma', () => {
    expect(formatDeadlineDay(ms, 'en-US', 'America/New_York')).toBe('Fri 3:30 PM');
  });
  it('uses the given time zone', () => {
    expect(formatDeadlineDay(ms, 'en-US', 'UTC')).toBe('Fri 8:30 PM');
  });
  it('time alone', () => {
    expect(formatDeadlineTime(ms, 'en-US', 'America/New_York')).toBe('3:30 PM');
  });
  it('follows the locale', () => {
    expect(formatDeadlineTime(ms, 'en-GB', 'UTC')).toBe('20:30');
    expect(formatDeadlineDay(ms, 'en-GB', 'UTC')).toBe('Fri 20:30');
  });
});
