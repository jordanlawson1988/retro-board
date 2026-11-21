import { describe, it, expect } from 'vitest';
import { PHASE_IDS, PHASES } from '@/lib/constants/phases';
import { BOARD_ACTIONS, type BoardAction } from '@/lib/constants/board-actions';
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
  needsMoveOnConfirm,
  formatDeadlineDay,
  formatDeadlineTime,
  guidedModeEnabled,
  phaseConfigAfterClose,
  canGoBack,
  ACTION_PHASE_GATE,
  deadlineNotice,
  deadlineRecheckMs,
  readyLabel,
  stepperInfoLines,
  stepperAreaHeight,
  STEPPER_ROW_PX,
  STEPPER_LINE_PX,
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
    ['group.title', 'reflect'], ['group.title', 'vote'], ['group.reset', 'discuss'],
    ['comment.create', 'reflect'], ['comment.edit', 'group'], ['comment.delete', 'vote'], ['topic.set', 'vote'], ['action-item.link', 'reflect'],
  ] as const)('%s is denied in %s', (action, phase) => {
    expect(phaseDenial(action, phase)).toBe(`Not available during ${PHASES[phase].label}`);
  });
  it.each([
    ['card.create', 'reflect'], ['card.edit', 'group'], ['card.move', 'group'], ['vote.toggle', 'vote'],
    ['group.title', 'group'], ['group.reset', 'group'],
    ['card.react', 'vote'], ['action-item.write', 'reflect'], ['board.settings', 'vote'], ['participant.leave', 'done'],
    ['comment.create', 'discuss'], ['topic.set', 'discuss'], ['action-item.link', 'discuss'],
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

describe('needsMoveOnConfirm', () => {
  it('asks when a phase with a ready step has people who are not ready', () => {
    expect(needsMoveOnConfirm('reflect', 3, 1)).toBe(true);
    expect(needsMoveOnConfirm('vote', 2, 0)).toBe(true);
  });
  it('does not ask when everyone is ready, nobody is online, or the phase has no ready step', () => {
    expect(needsMoveOnConfirm('reflect', 3, 3)).toBe(false);
    expect(needsMoveOnConfirm('reflect', 0, 0)).toBe(false);
    expect(needsMoveOnConfirm('discuss', 3, 0)).toBe(false);
  });
});

describe('guidedModeEnabled', () => {
  const flag = (key: string, is_enabled: boolean) => ({ id: key, key, is_enabled });
  it('is true only when a guided_mode flag is present and on', () => {
    expect(guidedModeEnabled({ flags: [flag('guided_mode', true)] })).toBe(true);
    expect(guidedModeEnabled({ flags: [flag('live_events', true), flag('guided_mode', true)] })).toBe(true);
  });
  it('is false when the flag is off or absent', () => {
    expect(guidedModeEnabled({ flags: [flag('guided_mode', false)] })).toBe(false);
    expect(guidedModeEnabled({ flags: [flag('live_events', true)] })).toBe(false);
    expect(guidedModeEnabled({ flags: [] })).toBe(false);
  });
  it('is false for a malformed response', () => {
    for (const bad of [null, undefined, 'x', 3, {}, { flags: null }, { flags: 'guided_mode' }, { flags: [null, 3, 'a'] }, { flags: [{ key: 'guided_mode', is_enabled: 'true' }] }]) {
      expect(guidedModeEnabled(bad)).toBe(false);
    }
  });
});

describe('phaseConfigAfterClose', () => {
  const cfg = { deadline: '2026-12-01T00:00:00.000Z' };
  it('clears the deadline when the event carries a phase (guided board)', () => {
    expect(phaseConfigAfterClose(cfg, { phase: 'done' })).toEqual({ deadline: null });
    expect(phaseConfigAfterClose(cfg, { phase: 'discuss' })).toEqual({ deadline: null });
  });
  it('leaves the config alone for an open board (phase null or missing) or garbage', () => {
    expect(phaseConfigAfterClose(cfg, { phase: null })).toBe(cfg);
    expect(phaseConfigAfterClose(cfg, {})).toBe(cfg);
    expect(phaseConfigAfterClose(cfg, undefined)).toBe(cfg);
    expect(phaseConfigAfterClose(cfg, { phase: 'bogus' })).toBe(cfg);
  });
});

describe('phaseDenial full table', () => {
  // Which phases ALLOW each action: reflect, group, vote, discuss, done.
  const ALLOWED: Record<BoardAction, readonly string[]> = {
    'card.create': ['reflect'],
    'card.edit': ['reflect', 'group'],
    'card.delete': ['reflect', 'group'],
    'card.move': ['group'],
    'group.title': ['group'],
    'group.reset': ['group'],
    'card.react': PHASE_IDS,
    'vote.toggle': ['vote'],
    'column.write': PHASE_IDS,
    'participant.manage': PHASE_IDS,
    'participant.leave': PHASE_IDS,
    'action-item.write': PHASE_IDS,
    'action-item.link': ['discuss'],
    'topic.set': ['discuss'],
    'comment.create': ['discuss'],
    'comment.edit': ['discuss'],
    'comment.delete': ['discuss'],
    'board.settings': PHASE_IDS,
  };
  it('covers every action', () => {
    expect(Object.keys(ALLOWED).sort()).toEqual([...BOARD_ACTIONS].sort());
    expect(Object.keys(ACTION_PHASE_GATE).sort()).toEqual([...BOARD_ACTIONS].sort());
  });
  for (const action of BOARD_ACTIONS) {
    for (const phase of PHASE_IDS) {
      it(`${action} in ${phase}`, () => {
        const expected = ALLOWED[action].includes(phase) ? null : `Not available during ${PHASES[phase].label}`;
        expect(phaseDenial(action, phase)).toBe(expected);
      });
    }
  }
});

describe('canGoBack', () => {
  it('is true exactly when resolvePhaseMove(phase, back) succeeds', () => {
    for (const phase of PHASE_IDS) {
      expect(canGoBack(phase)).toBe(resolvePhaseMove(phase, 'back').ok);
    }
  });
  it('is false at the first and final phases, true between', () => {
    expect(canGoBack('reflect')).toBe(false);
    expect(canGoBack('done')).toBe(false);
    expect(canGoBack('group')).toBe(true);
    expect(canGoBack('discuss')).toBe(true);
  });
});

describe('deadlineNotice', () => {
  const due = Date.parse('2026-11-20T15:30:00Z');
  const label = (id: 'reflect' | 'vote') => PHASES[id].label;
  it('is null with no deadline, a bad deadline, or once the retro is done', () => {
    expect(deadlineNotice('reflect', null, due)).toBeNull();
    expect(deadlineNotice('reflect', 'nope', due)).toBeNull();
    expect(deadlineNotice('done', new Date(due + 1000).toISOString(), due)).toBeNull();
  });
  it('open: the desktop chip wording from the shared formatters', () => {
    const n = deadlineNotice('reflect', new Date(due).toISOString(), due - 1000)!;
    expect(n.state).toBe('open');
    expect(n.dueMs).toBe(due);
    expect(n.text).toBe(`${label('reflect')} closes ${formatDeadlineDay(due)}`);
  });
  it('passed: the desktop banner wording', () => {
    const n = deadlineNotice('vote', new Date(due).toISOString(), due)!;
    expect(n.state).toBe('passed');
    expect(n.text).toBe(`${label('vote')} closed at ${formatDeadlineTime(due)}. Waiting for the facilitator.`);
  });
});

describe('deadlineRecheckMs', () => {
  const due = 1_000_000;
  it('is null with no deadline, a bad one, or one already passed', () => {
    expect(deadlineRecheckMs(null, 0, 5000)).toBeNull();
    expect(deadlineRecheckMs('nope', 0, 5000)).toBeNull();
    expect(deadlineRecheckMs(new Date(due).toISOString(), due, 5000)).toBeNull();
    expect(deadlineRecheckMs(new Date(due).toISOString(), due + 10, 5000)).toBeNull();
  });
  it('waits until just after the deadline, capped at the maximum', () => {
    expect(deadlineRecheckMs(new Date(due).toISOString(), due - 1000, 5000)).toBe(1050);
    expect(deadlineRecheckMs(new Date(due).toISOString(), due - 100_000, 5000)).toBe(5000);
  });
});

describe('readyLabel', () => {
  it('matches the desktop wording', () => {
    expect(readyLabel(2, 5)).toBe('2 of 5 ready');
    expect(readyLabel(0, 0)).toBe('0 of 0 ready');
  });
});

describe('phone stepper area height', () => {
  it('one info line when only one thing shows, or the chip and the count share a line', () => {
    expect(stepperInfoLines('none', false)).toBe(0);
    expect(stepperInfoLines('open', false)).toBe(1);
    expect(stepperInfoLines('passed', false)).toBe(1);
    expect(stepperInfoLines('none', true)).toBe(1);
    expect(stepperInfoLines('open', true)).toBe(1);
  });
  it('a passed deadline is too long to share its line with the count', () => {
    expect(stepperInfoLines('passed', true)).toBe(2);
  });
  it('height is the row plus the lines', () => {
    expect(stepperAreaHeight(0)).toBe(STEPPER_ROW_PX);
    expect(stepperAreaHeight(2)).toBe(STEPPER_ROW_PX + 2 * STEPPER_LINE_PX);
    expect(STEPPER_ROW_PX).toBe(56);
  });
});
