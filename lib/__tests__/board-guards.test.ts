import { describe, it, expect } from 'vitest';
import { BOARD_ACTIONS, type BoardAction } from '@/lib/constants/board-actions';
import {
  checkAction,
  reactionsChangeOnlyTouches,
  type BoardActor,
  type BoardState,
} from '@/lib/board-guards';
import type { BoardSettings } from '@/types';

const baseSettings: BoardSettings = {
  card_visibility: 'visible',
  voting_enabled: true,
  max_votes_per_participant: 5,
  secret_voting: false,
  board_locked: false,
  card_creation_disabled: false,
  anonymous_cards: false,
  timer: { duration: 0, remaining: 0, status: 'idle', started_at: null },
  highlighted_card_id: null,
};

function actor(overrides: Partial<BoardActor> = {}): BoardActor {
  return {
    boardId: 'b1',
    trustVersion: 2,
    participantId: 'p1',
    userId: null,
    isFacilitator: false,
    ...overrides,
  };
}

function state(overrides: Partial<Omit<BoardState, 'settings'>> & { settings?: Partial<BoardSettings> } = {}): BoardState {
  const { settings, ...rest } = overrides;
  return { archived: false, ...rest, settings: { ...baseSettings, ...settings } };
}

describe('BOARD_ACTIONS contract', () => {
  const facilitator = actor({ isFacilitator: true });
  const target = { authorId: 'p1', participantId: 'p1' };

  it.each([...BOARD_ACTIONS])('%s is allowed for a facilitator on an open board', (a) => {
    expect(checkAction(a, facilitator, state(), target)).toEqual({ ok: true });
  });

  it.each([...BOARD_ACTIONS])('%s is 409 on an archived board', (a) => {
    const r = checkAction(a, facilitator, state({ archived: true }), target);
    expect(r).toEqual({ ok: false, status: 409, error: 'Board is completed' });
  });

  it.each([...BOARD_ACTIONS])('%s is 409 on an archived v1 board too', (a) => {
    const r = checkAction(a, actor({ trustVersion: 1 }), state({ archived: true }), target);
    expect(r).toMatchObject({ ok: false, status: 409 });
  });
});

describe('state rules (every board)', () => {
  it('locked board rejects card.*, vote.toggle and action-item.write for non-facilitators', () => {
    const locked = state({ settings: { board_locked: true } });
    const guarded: BoardAction[] = [
      'card.create', 'card.edit', 'card.delete', 'card.move', 'card.react',
      'vote.toggle', 'action-item.write',
    ];
    for (const a of guarded) {
      expect(checkAction(a, actor(), locked, { authorId: 'p1' })).toEqual({
        ok: false, status: 409, error: 'Board is locked',
      });
    }
  });

  it('locked board does not block column.write for a facilitator or unrelated actions', () => {
    const locked = state({ settings: { board_locked: true } });
    expect(checkAction('column.write', actor({ isFacilitator: true }), locked)).toEqual({ ok: true });
    expect(checkAction('participant.leave', actor(), locked, { participantId: 'p1' })).toEqual({ ok: true });
  });

  it('locked board lets a facilitator create a card', () => {
    const locked = state({ settings: { board_locked: true } });
    expect(checkAction('card.create', actor({ isFacilitator: true }), locked)).toEqual({ ok: true });
  });

  it('v1 locked board card.create is 409', () => {
    const locked = state({ settings: { board_locked: true } });
    expect(checkAction('card.create', actor({ trustVersion: 1 }), locked)).toEqual({
      ok: false, status: 409, error: 'Board is locked',
    });
  });

  it('vote.toggle with voting off is 409 even for a facilitator', () => {
    const off = state({ settings: { voting_enabled: false } });
    expect(checkAction('vote.toggle', actor({ isFacilitator: true }), off)).toEqual({
      ok: false, status: 409, error: 'Voting is closed',
    });
    expect(checkAction('vote.toggle', actor(), off)).toEqual({
      ok: false, status: 409, error: 'Voting is closed',
    });
  });

  it('card creation off blocks non-facilitators but not facilitators', () => {
    const off = state({ settings: { card_creation_disabled: true } });
    expect(checkAction('card.create', actor(), off)).toEqual({
      ok: false, status: 409, error: 'Card creation is off',
    });
    expect(checkAction('card.create', actor({ isFacilitator: true }), off)).toEqual({ ok: true });
    expect(checkAction('card.edit', actor(), off, { authorId: 'p1' })).toEqual({ ok: true });
  });

  it('state rules run before identity rules (archived beats 401)', () => {
    expect(checkAction('card.create', actor({ participantId: null }), state({ archived: true }))).toMatchObject({
      status: 409,
    });
  });
});

describe('identity rules (v2)', () => {
  it('no participant session and not a facilitator is 401', () => {
    const r = checkAction('card.create', actor({ participantId: null }), state());
    expect(r).toEqual({ ok: false, status: 401, error: 'Join the board first' });
  });

  it('no participant session is 401 for every action that is not facilitator-held', () => {
    for (const a of BOARD_ACTIONS) {
      const r = checkAction(a, actor({ participantId: null }), state(), {});
      expect(r).toMatchObject({ ok: false, status: 401 });
    }
  });

  it('a facilitator with no participant row can still create a card', () => {
    expect(checkAction('card.create', actor({ participantId: null, isFacilitator: true }), state())).toEqual({ ok: true });
  });

  it('author edits own card', () => {
    expect(checkAction('card.edit', actor(), state(), { authorId: 'p1' })).toEqual({ ok: true });
  });

  it('another participant editing gets 403', () => {
    const r = checkAction('card.edit', actor({ participantId: 'p2' }), state(), { authorId: 'p1' });
    expect(r).toMatchObject({ ok: false, status: 403 });
  });

  it('another participant deleting gets 403', () => {
    const r = checkAction('card.delete', actor({ participantId: 'p2' }), state(), { authorId: 'p1' });
    expect(r).toMatchObject({ ok: false, status: 403 });
  });

  it('a card with no author cannot be edited by a non-facilitator', () => {
    expect(checkAction('card.edit', actor(), state(), { authorId: null })).toMatchObject({ status: 403 });
    expect(checkAction('card.edit', actor(), state(), {})).toMatchObject({ status: 403 });
  });

  it('facilitator edits and deletes another participant card', () => {
    const f = actor({ participantId: 'p2', isFacilitator: true });
    expect(checkAction('card.edit', f, state(), { authorId: 'p1' })).toEqual({ ok: true });
    expect(checkAction('card.delete', f, state(), { authorId: 'p1' })).toEqual({ ok: true });
  });

  it('card.move, card.react, vote.toggle and action-item.write are open to any identified participant', () => {
    for (const a of ['card.move', 'card.react', 'vote.toggle', 'action-item.write'] as const) {
      expect(checkAction(a, actor(), state(), { authorId: 'someone-else' })).toEqual({ ok: true });
    }
  });

  it('column.write, participant.manage and board.settings need a facilitator', () => {
    for (const a of ['column.write', 'participant.manage', 'board.settings'] as const) {
      expect(checkAction(a, actor(), state())).toMatchObject({ ok: false, status: 403 });
      expect(checkAction(a, actor({ isFacilitator: true }), state())).toEqual({ ok: true });
    }
  });

  it('participant.leave needs the target to be yourself', () => {
    expect(checkAction('participant.leave', actor(), state(), { participantId: 'p1' })).toEqual({ ok: true });
    expect(checkAction('participant.leave', actor(), state(), { participantId: 'p2' })).toMatchObject({
      ok: false, status: 403,
    });
    expect(checkAction('participant.leave', actor(), state(), {})).toMatchObject({ status: 403 });
  });
});

describe('v1 boards keep the legacy identity model', () => {
  const v1 = (o: Partial<BoardActor> = {}) => actor({ trustVersion: 1, ...o });

  it('a claimed participant id may edit another participant card', () => {
    expect(checkAction('card.edit', v1({ participantId: 'anything' }), state(), { authorId: 'p1' })).toEqual({ ok: true });
  });

  it('a null participant id may create a card', () => {
    expect(checkAction('card.create', v1({ participantId: null }), state())).toEqual({ ok: true });
  });

  it('column.write and participant.manage are not identity guarded', () => {
    expect(checkAction('column.write', v1(), state())).toEqual({ ok: true });
    expect(checkAction('participant.manage', v1(), state())).toEqual({ ok: true });
  });

  it('board.settings stays facilitator-only', () => {
    expect(checkAction('board.settings', v1(), state())).toMatchObject({ ok: false, status: 403 });
    expect(checkAction('board.settings', v1({ isFacilitator: true }), state())).toEqual({ ok: true });
  });
});

describe('reactionsChangeOnlyTouches', () => {
  it('adding own id is ok', () => {
    expect(reactionsChangeOnlyTouches({ '👍': ['p2'] }, { '👍': ['p2', 'p1'] }, 'p1')).toBe(true);
  });

  it('removing own id is ok', () => {
    expect(reactionsChangeOnlyTouches({ '👍': ['p2', 'p1'] }, { '👍': ['p2'] }, 'p1')).toBe(true);
  });

  it("adding someone else's id is rejected", () => {
    expect(reactionsChangeOnlyTouches({ '👍': ['p2'] }, { '👍': ['p2', 'p3'] }, 'p1')).toBe(false);
  });

  it("removing someone else's id is rejected", () => {
    expect(reactionsChangeOnlyTouches({ '👍': ['p2', 'p3'] }, { '👍': ['p2'] }, 'p1')).toBe(false);
  });

  it('adding a new emoji with only own id is ok', () => {
    expect(reactionsChangeOnlyTouches({ '👍': ['p2'] }, { '👍': ['p2'], '🎉': ['p1'] }, 'p1')).toBe(true);
  });

  it('adding a new emoji with someone else in it is rejected', () => {
    expect(reactionsChangeOnlyTouches({}, { '🎉': ['p1', 'p2'] }, 'p1')).toBe(false);
  });

  it('dropping an emoji that held only other people is rejected', () => {
    expect(reactionsChangeOnlyTouches({ '👍': ['p2'] }, {}, 'p1')).toBe(false);
  });

  it('removing the last own id so the emoji disappears is ok', () => {
    expect(reactionsChangeOnlyTouches({ '👍': ['p1'] }, {}, 'p1')).toBe(true);
  });

  it('no change is ok', () => {
    expect(reactionsChangeOnlyTouches({ '👍': ['p2'] }, { '👍': ['p2'] }, 'p1')).toBe(true);
  });

  it('touching two emojis with own id is ok', () => {
    expect(
      reactionsChangeOnlyTouches({ '👍': ['p2'], '🎉': ['p1'] }, { '👍': ['p2', 'p1'], '🎉': [] }, 'p1')
    ).toBe(true);
  });
});
