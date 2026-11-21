import { describe, it, expect } from 'vitest';
import { BOARD_ACTIONS, type BoardAction } from '@/lib/constants/board-actions';
import {
  checkAction,
  reactionsChangeOnlyTouches,
  type BoardActor,
  type BoardState,
} from '@/lib/board-guards';
import type { BoardSettings } from '@/types';
import { phaseSettings } from '@/lib/phases';

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
  return { archived: false, phase: null, ...rest, settings: { ...baseSettings, ...settings } };
}

const GUIDED_ONLY = ['topic.set', 'comment.create', 'comment.edit', 'comment.delete', 'action-item.link'];
/** An open board for every action, except the guided-only ones, which get a Discuss board. */
const stateFor = (a: BoardAction) =>
  GUIDED_ONLY.includes(a) ? state({ phase: 'discuss', settings: phaseSettings('discuss') }) : state();

describe('BOARD_ACTIONS contract', () => {
  const facilitator = actor({ isFacilitator: true });
  const target = { authorId: 'p1', participantId: 'p1' };

  it.each([...BOARD_ACTIONS])('%s is allowed for a facilitator on an open board', (a) => {
    expect(checkAction(a, facilitator, stateFor(a), target)).toEqual({ ok: true });
  });

  const ARCHIVED_EXEMPT = ['participant.leave'];
  const archivedBlocked = BOARD_ACTIONS.filter((a) => !ARCHIVED_EXEMPT.includes(a));

  it.each([...archivedBlocked])('%s is 409 on an archived board', (a) => {
    const r = checkAction(a, facilitator, state({ archived: true }), target);
    expect(r).toEqual({ ok: false, status: 409, error: 'Board is completed' });
  });

  it.each([...archivedBlocked])('%s is 409 on an archived v1 board too', (a) => {
    const r = checkAction(a, actor({ trustVersion: 1 }), state({ archived: true }), target);
    expect(r).toMatchObject({ ok: false, status: 409 });
  });

  it('participant.leave is allowed on an archived board (v1 and v2)', () => {
    expect(checkAction('participant.leave', actor(), state({ archived: true }), target)).toEqual({ ok: true });
    expect(
      checkAction('participant.leave', actor({ trustVersion: 1 }), state({ archived: true }), target)
    ).toEqual({ ok: true });
  });

  it('participant.leave on an archived v2 board still requires leaving as yourself', () => {
    expect(
      checkAction('participant.leave', actor(), state({ archived: true }), { participantId: 'someone-else' })
    ).toMatchObject({ ok: false, status: 403 });
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
      const r = checkAction(a, actor({ participantId: null }), stateFor(a), {});
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

describe('checkAction fail-closed trustVersion', () => {
  it('an undefined trustVersion still applies identity rules', () => {
    const actor = {
      boardId: 'b',
      trustVersion: undefined as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      participantId: 'p9',
      userId: null,
      isFacilitator: false,
    } as BoardActor;
    const state: BoardState = { archived: false, phase: null, settings: baseSettings };
    expect(checkAction('card.edit', actor, state, { authorId: 'p1' }).ok).toBe(false);
  });
});

describe('reactionsChangeOnlyTouches', () => {
  it('rejects duplicates and malformed values without throwing', () => {
    expect(reactionsChangeOnlyTouches({ '👍': [] }, { '👍': ['p1', 'p1', 'p1'] }, 'p1')).toBe(false);
    expect(reactionsChangeOnlyTouches({ '👍': ['p1'] }, { '👍': ['p1', 'p1'] }, 'p1')).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(reactionsChangeOnlyTouches({ '👍': [] }, { '👍': 'p1' } as any, 'p1')).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(reactionsChangeOnlyTouches({ '👍': [] }, { '👍': 5 } as any, 'p1')).toBe(false);
  });

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

describe('phase rule in checkAction', () => {
  const v2Participant = actor();
  const v2Facilitator = actor({ isFacilitator: true });

  it('an open board (phase null) is untouched by the phase rule', () => {
    expect(checkAction('card.move', v2Participant, state({ phase: null }))).toEqual({ ok: true });
  });
  it('a guided board denies by phase with 409, for the facilitator too', () => {
    const s = state({ phase: 'vote', settings: { ...baseSettings, ...phaseSettings('vote') } });
    expect(checkAction('card.create', v2Facilitator, s)).toEqual({ ok: false, status: 409, error: 'Not available during Vote' });
    expect(checkAction('vote.toggle', v2Participant, s)).toEqual({ ok: true });
  });
  it('completed wins over the phase message', () => {
    expect(checkAction('vote.toggle', v2Participant, state({ archived: true, phase: 'done' })))
      .toEqual({ ok: false, status: 409, error: 'Board is completed' });
  });
});

describe('group actions', () => {
  const inGroup = state({ phase: 'group', settings: phaseSettings('group') });
  const inVote = state({ phase: 'vote', settings: phaseSettings('vote') });
  it('group.title: any joined participant during Group, refused in other phases', () => {
    expect(checkAction('group.title', actor(), inGroup)).toEqual({ ok: true });
    expect(checkAction('group.title', actor(), inVote)).toEqual({ ok: false, status: 409, error: 'Not available during Vote' });
  });
  it('group.title: 401 for someone who has not joined', () => {
    expect(checkAction('group.title', actor({ participantId: null }), inGroup)).toEqual({ ok: false, status: 401, error: 'Join the board first' });
  });
  it('group.reset: facilitator only, during Group only', () => {
    expect(checkAction('group.reset', actor(), inGroup)).toEqual({ ok: false, status: 403, error: 'Facilitator access required' });
    expect(checkAction('group.reset', actor({ isFacilitator: true }), inGroup)).toEqual({ ok: true });
    expect(checkAction('group.reset', actor({ isFacilitator: true }), inVote)).toEqual({ ok: false, status: 409, error: 'Not available during Vote' });
  });
  it('group.reset is facilitator-only on a v1 board too', () => {
    expect(checkAction('group.reset', actor({ trustVersion: 1 }), state())).toEqual({ ok: false, status: 403, error: 'Facilitator access required' });
  });
  it('group.title: a facilitator without a participant row passes; a legacy v1 participant passes', () => {
    expect(checkAction('group.title', actor({ participantId: null, isFacilitator: true }), inGroup)).toEqual({ ok: true });
    expect(checkAction('group.title', actor({ trustVersion: 1 }), inGroup)).toEqual({ ok: true });
  });
  it('group.title is refused on a locked board for a non-facilitator, allowed for a facilitator', () => {
    const locked = state({ phase: 'group', settings: { ...phaseSettings('group'), board_locked: true } });
    expect(checkAction('group.title', actor(), locked)).toEqual({ ok: false, status: 409, error: 'Board is locked' });
    expect(checkAction('group.title', actor({ isFacilitator: true }), locked)).toEqual({ ok: true });
  });
});

describe('discuss actions', () => {
  const inDiscuss = state({ phase: 'discuss', settings: phaseSettings('discuss') });
  const inVote = state({ phase: 'vote', settings: phaseSettings('vote') });
  it('comment.create, comment.edit and action-item.link: any joined participant during Discuss only', () => {
    for (const a of ['comment.create', 'comment.edit', 'action-item.link'] as const) {
      expect(checkAction(a, actor(), inDiscuss)).toEqual({ ok: true });
      expect(checkAction(a, actor(), inVote)).toEqual({ ok: false, status: 409, error: 'Not available during Vote' });
      expect(checkAction(a, actor({ participantId: null }), inDiscuss)).toEqual({ ok: false, status: 401, error: 'Join the board first' });
    }
  });
  it('comment.delete passes a facilitator who has no participant row', () => {
    expect(checkAction('comment.delete', actor({ participantId: null, isFacilitator: true }), inDiscuss)).toEqual({ ok: true });
  });
  it('topic.set: facilitator only, Discuss only, on any trust version', () => {
    expect(checkAction('topic.set', actor(), inDiscuss)).toEqual({ ok: false, status: 403, error: 'Facilitator access required' });
    expect(checkAction('topic.set', actor({ isFacilitator: true }), inDiscuss)).toEqual({ ok: true });
    expect(checkAction('topic.set', actor({ isFacilitator: true }), inVote)).toEqual({ ok: false, status: 409, error: 'Not available during Vote' });
    expect(checkAction('topic.set', actor({ trustVersion: 1 }), inDiscuss)).toEqual({ ok: false, status: 403, error: 'Facilitator access required' });
    expect(checkAction('topic.set', actor({ trustVersion: 1, isFacilitator: true }), inDiscuss)).toEqual({ ok: true });
  });
  it('a completed board refuses every comment action', () => {
    const done = state({ phase: 'done', archived: true, settings: phaseSettings('done') });
    expect(checkAction('comment.create', actor(), done)).toEqual({ ok: false, status: 409, error: 'Board is completed' });
    for (const a of ['topic.set', 'comment.edit', 'comment.delete', 'action-item.link'] as const) {
      expect(checkAction(a, actor({ isFacilitator: true }), done)).toEqual({ ok: false, status: 409, error: 'Board is completed' });
    }
  });
  it('a locked board refuses the comment and link actions for a non-facilitator, not a facilitator', () => {
    const locked = state({ phase: 'discuss', settings: { ...phaseSettings('discuss'), board_locked: true } });
    for (const a of ['comment.create', 'comment.edit', 'comment.delete', 'action-item.link'] as const) {
      expect(checkAction(a, actor(), locked)).toEqual({ ok: false, status: 409, error: 'Board is locked' });
      expect(checkAction(a, actor({ isFacilitator: true }), locked)).toEqual({ ok: true });
    }
  });
});

describe('discuss actions: identity for a facilitator with no participant row', () => {
  const inDiscuss = state({ phase: 'discuss', settings: phaseSettings('discuss') });
  const inVote = state({ phase: 'vote', settings: phaseSettings('vote') });
  const rowless = actor({ participantId: null, isFacilitator: true });
  it('comment.create and comment.edit need a participant, a facilitator included', () => {
    for (const a of ['comment.create', 'comment.edit'] as const) {
      expect(checkAction(a, rowless, inDiscuss)).toEqual({ ok: false, status: 401, error: 'Join the board first' });
    }
  });
  it('comment.delete, topic.set and action-item.link pass such a facilitator', () => {
    for (const a of ['comment.delete', 'topic.set', 'action-item.link'] as const) {
      expect(checkAction(a, rowless, inDiscuss)).toEqual({ ok: true });
    }
  });
  it('a not-joined non-facilitator gets 401 for all five', () => {
    for (const a of ['comment.create', 'comment.edit', 'comment.delete', 'topic.set', 'action-item.link'] as const) {
      expect(checkAction(a, actor({ participantId: null }), inDiscuss)).toEqual({ ok: false, status: 401, error: 'Join the board first' });
    }
  });
  it('the phase refusal still comes before identity', () => {
    expect(checkAction('comment.create', rowless, inVote)).toEqual({ ok: false, status: 409, error: 'Not available during Vote' });
  });
  it('a facilitator with a row may comment', () => {
    expect(checkAction('comment.create', actor({ isFacilitator: true }), inDiscuss)).toEqual({ ok: true });
  });
});

describe('guided-only actions on an open board', () => {
  const NOT_GUIDED = { ok: false, status: 409, error: 'This board is not in guided mode' };
  const five = ['topic.set', 'comment.create', 'comment.edit', 'comment.delete', 'action-item.link'] as const;
  it('are refused for a joined participant and for a facilitator', () => {
    for (const a of five) {
      expect(checkAction(a, actor(), state())).toEqual(NOT_GUIDED);
      expect(checkAction(a, actor({ isFacilitator: true }), state())).toEqual(NOT_GUIDED);
      expect(checkAction(a, actor({ trustVersion: 1, isFacilitator: true }), state())).toEqual(NOT_GUIDED);
    }
  });
  it('a completed open board still says completed (that rule comes first)', () => {
    for (const a of five) {
      expect(checkAction(a, actor(), state({ archived: true }))).toEqual({ ok: false, status: 409, error: 'Board is completed' });
    }
  });
  it('existing actions decide on an open board exactly as before', () => {
    for (const a of ['action-item.write', 'card.create', 'vote.toggle'] as const) {
      expect(checkAction(a, actor(), state())).toEqual({ ok: true });
    }
    expect(checkAction('vote.toggle', actor(), state({ settings: { voting_enabled: false } }))).toEqual({ ok: false, status: 409, error: 'Voting is closed' });
    expect(checkAction('card.create', actor({ participantId: null }), state())).toEqual({ ok: false, status: 401, error: 'Join the board first' });
  });
});
