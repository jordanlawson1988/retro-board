import { describe, it, expect } from 'vitest';
import {
  buildActor,
  cardPatchActions,
  participantRemovalAction,
  firstDenial,
  patchNeedsSettingsGuard,
  resolveYouAre,
  checkCreatorProtection,
} from '@/lib/board-write-rules';
import type { BoardActor, BoardState } from '@/lib/board-guards';
import type { BoardSettings } from '@/types';

describe('cardPatchActions', () => {
  it('maps text and color to card.edit once', () => {
    expect(cardPatchActions({ text: 'x', color: '#fff' })).toEqual(['card.edit']);
  });
  it('maps column_id, position, merged_with to card.move once', () => {
    expect(cardPatchActions({ column_id: 'c', position: 1, merged_with: null })).toEqual(['card.move']);
  });
  it('maps reactions to card.react', () => {
    expect(cardPatchActions({ reactions: {} })).toEqual(['card.react']);
  });
  it('a mixed request needs every action it touches', () => {
    expect(cardPatchActions({ text: 'x', position: 2, reactions: {} })).toEqual([
      'card.edit',
      'card.move',
      'card.react',
    ]);
  });
  it('ignores undefined values and unknown fields', () => {
    expect(cardPatchActions({ text: undefined, bogus: 1 })).toEqual([]);
  });
  it('treats null color as an edit (clearing the color)', () => {
    expect(cardPatchActions({ color: null })).toEqual(['card.edit']);
  });
});

describe('participantRemovalAction', () => {
  it('is leave when the target is the actor', () => {
    expect(participantRemovalAction('p1', 'p1')).toBe('participant.leave');
  });
  it('is manage for someone else', () => {
    expect(participantRemovalAction('p1', 'p2')).toBe('participant.manage');
  });
  it('is manage when the actor has no participant id', () => {
    expect(participantRemovalAction(null, 'p2')).toBe('participant.manage');
    expect(participantRemovalAction(null, null)).toBe('participant.manage');
  });
});

describe('patchNeedsSettingsGuard', () => {
  it('false for title/description only', () => {
    expect(patchNeedsSettingsGuard({ title: 'a', description: null })).toBe(false);
  });
  it('true when settings present', () => {
    expect(patchNeedsSettingsGuard({ title: 'a', settings: {} })).toBe(true);
  });
  it('false when settings undefined', () => {
    expect(patchNeedsSettingsGuard({ settings: undefined })).toBe(false);
  });
});

describe('buildActor', () => {
  const base = {
    boardId: 'b1',
    cookieParticipantId: null as string | null,
    cookieParticipant: null as { is_admin: boolean } | null,
    legacyParticipantId: null as string | null,
    userId: null as string | null,
    hasAuthority: false,
  };

  it('v2 uses the cookie participant and ignores the legacy id', () => {
    const a = buildActor({
      ...base,
      trustVersion: 2,
      cookieParticipantId: 'p1',
      cookieParticipant: { is_admin: false },
      legacyParticipantId: 'evil',
    });
    expect(a.participantId).toBe('p1');
    expect(a.isFacilitator).toBe(false);
  });
  it('v2 cookie id with no participant row resolves to null', () => {
    const a = buildActor({ ...base, trustVersion: 2, cookieParticipantId: 'gone', cookieParticipant: null });
    expect(a.participantId).toBeNull();
  });
  it('v2 participant is_admin makes a facilitator', () => {
    const a = buildActor({
      ...base,
      trustVersion: 2,
      cookieParticipantId: 'p1',
      cookieParticipant: { is_admin: true },
    });
    expect(a.isFacilitator).toBe(true);
  });
  it('v2 signed-in authority makes a facilitator without a participant', () => {
    const a = buildActor({ ...base, trustVersion: 2, userId: 'u1', hasAuthority: true });
    expect(a).toMatchObject({ participantId: null, isFacilitator: true, userId: 'u1' });
  });
  it('v1 uses the legacy id and authority only, ignoring is_admin and cookie', () => {
    const a = buildActor({
      ...base,
      trustVersion: 1,
      legacyParticipantId: 'claimed',
      cookieParticipantId: 'p1',
      cookieParticipant: { is_admin: true },
    });
    expect(a.participantId).toBe('claimed');
    expect(a.isFacilitator).toBe(false);
    expect(buildActor({ ...base, trustVersion: 1, hasAuthority: true }).isFacilitator).toBe(true);
  });
  it('v1 without a legacy id has null participant', () => {
    expect(buildActor({ ...base, trustVersion: 1 }).participantId).toBeNull();
  });
});

describe('firstDenial', () => {
  const settings = { voting_enabled: true, board_locked: false } as BoardSettings;
  const state: BoardState = { archived: false, phase: null, settings };
  const actor: BoardActor = {
    boardId: 'b',
    trustVersion: 2,
    participantId: 'p1',
    userId: null,
    isFacilitator: false,
  };
  it('returns null when every action passes', () => {
    expect(firstDenial(['card.move', 'card.react'], actor, state)).toBeNull();
  });
  it('returns the first failing result', () => {
    const d = firstDenial(['card.move', 'card.edit'], actor, state, { authorId: 'other' });
    expect(d).toMatchObject({ ok: false, status: 403 });
  });
  it('returns null for no actions', () => {
    expect(firstDenial([], actor, state)).toBeNull();
  });
});

describe('resolveYouAre', () => {
  const base = {
    actorParticipantId: null as string | null,
    actorIsFacilitator: false,
    matchedParticipantId: null as string | null,
    authorityCanFacilitate: false,
  };

  it('v2 with no cookie and a signed-in match is not joined', () => {
    expect(resolveYouAre({ ...base, trustVersion: 2, matchedParticipantId: 'p-user' })).toEqual({
      participantId: null,
      isFacilitator: false,
      joined: false,
    });
  });
  it('v2 with a cookie uses exactly the cookie participant', () => {
    expect(
      resolveYouAre({
        ...base,
        trustVersion: 2,
        actorParticipantId: 'p-cookie',
        actorIsFacilitator: true,
        matchedParticipantId: 'p-other',
      })
    ).toEqual({ participantId: 'p-cookie', isFacilitator: true, joined: true });
  });
  it('v2 signed-in authority without a cookie is a facilitator but not joined', () => {
    expect(resolveYouAre({ ...base, trustVersion: 2, authorityCanFacilitate: true })).toEqual({
      participantId: null,
      isFacilitator: true,
      joined: false,
    });
  });
  it('v1 uses the matched participant and authority, as before', () => {
    expect(
      resolveYouAre({ ...base, trustVersion: 1, matchedParticipantId: 'p-user', authorityCanFacilitate: true })
    ).toEqual({ participantId: 'p-user', isFacilitator: true, joined: true });
    expect(resolveYouAre({ ...base, trustVersion: 1 })).toEqual({
      participantId: null,
      isFacilitator: false,
      joined: false,
    });
  });
});

describe('checkCreatorProtection', () => {
  const board = { created_by: 'p-creator', owner_id: 'u-owner' };
  const denied = { ok: false, status: 403, error: 'The board creator cannot be demoted or removed' };

  it('blocks demoting the creator participant', () => {
    expect(
      checkCreatorProtection({ change: 'demote', target: { id: 'p-creator', user_id: null }, board, actorParticipantId: 'p-admin' })
    ).toEqual(denied);
  });
  it('blocks demoting the owner account participant', () => {
    expect(
      checkCreatorProtection({ change: 'demote', target: { id: 'p-x', user_id: 'u-owner' }, board, actorParticipantId: 'p-admin' })
    ).toEqual(denied);
  });
  it('blocks demoting even by oneself', () => {
    expect(
      checkCreatorProtection({ change: 'demote', target: { id: 'p-creator', user_id: null }, board, actorParticipantId: 'p-creator' })
    ).toEqual(denied);
  });
  it('blocks removal by someone else but allows leaving', () => {
    const target = { id: 'p-creator', user_id: null };
    expect(checkCreatorProtection({ change: 'remove', target, board, actorParticipantId: 'p-admin' })).toEqual(denied);
    expect(checkCreatorProtection({ change: 'remove', target, board, actorParticipantId: 'p-creator' })).toEqual({ ok: true });
  });
  it('allows everything for ordinary participants', () => {
    const target = { id: 'p-2', user_id: 'u-2' };
    expect(checkCreatorProtection({ change: 'demote', target, board, actorParticipantId: 'p-admin' })).toEqual({ ok: true });
    expect(checkCreatorProtection({ change: 'remove', target, board, actorParticipantId: 'p-admin' })).toEqual({ ok: true });
  });
  it('a null owner_id never matches a null user_id', () => {
    expect(
      checkCreatorProtection({
        change: 'remove',
        target: { id: 'p-2', user_id: null },
        board: { created_by: null, owner_id: null },
        actorParticipantId: 'p-admin',
      })
    ).toEqual({ ok: true });
  });
});
