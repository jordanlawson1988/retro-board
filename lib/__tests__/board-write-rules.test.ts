import { describe, it, expect } from 'vitest';
import {
  buildActor,
  cardPatchActions,
  participantRemovalAction,
  firstDenial,
  patchNeedsSettingsGuard,
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
  const state: BoardState = { archived: false, settings };
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
