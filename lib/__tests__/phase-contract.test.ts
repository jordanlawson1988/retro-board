import { describe, it, expect } from 'vitest';
import { BOARD_ACTIONS } from '@/lib/constants/board-actions';
import { PHASE_IDS, type PhaseId } from '@/lib/constants/phases';
import { checkAction, type BoardActor } from '@/lib/board-guards';
import { applyPhaseChanged, phaseSettings, railSteps } from '@/lib/phases';
import { validateSettingsPatch } from '@/lib/board-validation';
import { DEFAULT_BOARD_SETTINGS } from '@/utils/constants';

const facilitator: BoardActor = {
  boardId: 'b1',
  trustVersion: 2,
  participantId: 'p1',
  userId: null,
  isFacilitator: true,
};

describe.each(PHASE_IDS)('phase %s round-trips', (id) => {
  it('through the guard: every action gets a decision, never "Unhandled"', () => {
    const s = { archived: false, phase: id, settings: { ...DEFAULT_BOARD_SETTINGS, ...phaseSettings(id) } };
    for (const action of BOARD_ACTIONS) {
      const r = checkAction(action, facilitator, s, { authorId: facilitator.participantId, participantId: facilitator.participantId });
      if (!r.ok) expect(r.error).not.toMatch(/Unhandled/);
    }
  });
  it('through the settings validator', () => {
    expect(validateSettingsPatch(phaseSettings(id) as Record<string, unknown>).ok).toBe(true);
  });
  it('through the store reducer', () => {
    const b = { phase: 'reflect' as PhaseId, settings: DEFAULT_BOARD_SETTINGS, phase_config: { deadline: null } };
    expect(applyPhaseChanged(b, { phase: id, settings: DEFAULT_BOARD_SETTINGS, phaseConfig: { deadline: null } }).phase).toBe(id);
  });
  it('through the phase rail', () => {
    const steps = railSteps(id);
    expect(steps.map((s) => s.id)).toEqual([...PHASE_IDS]);
    expect(steps.filter((s) => s.state === 'current').map((s) => s.id)).toEqual([id]);
  });
});
