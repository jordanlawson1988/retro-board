import { describe, it, expect } from 'vitest';
import { validateSettingsPatch } from '@/lib/board-validation';
import { DEFAULT_BOARD_SETTINGS } from '@/utils/constants';

const err = (p: Record<string, unknown>) => {
  const r = validateSettingsPatch(p);
  return r.ok ? null : r.error;
};

describe('validateSettingsPatch', () => {
  it('accepts every key of DEFAULT_BOARD_SETTINGS with its default value (no drift)', () => {
    for (const [key, value] of Object.entries(DEFAULT_BOARD_SETTINGS)) {
      expect(validateSettingsPatch({ [key]: value }), key).toEqual({ ok: true, value: { [key]: value } });
    }
    expect(validateSettingsPatch({ ...DEFAULT_BOARD_SETTINGS }).ok).toBe(true);
  });

  it('accepts an empty patch', () => {
    expect(validateSettingsPatch({}).ok).toBe(true);
  });

  it('rejects unknown top-level keys, including prototype names', () => {
    expect(err({ nope: 1 })).toBe('Unknown setting: nope');
    expect(err({ card_visibility: 'visible', extra: true })).toBe('Unknown setting: extra');
    expect(err(JSON.parse('{"__proto__": {"x": 1}}'))).toContain('Unknown setting');
    expect(err({ toString: 'x' })).toContain('Unknown setting');
  });

  it('rejects wrong values and types', () => {
    expect(err({ card_visibility: 'open' })).toBe('Invalid value for setting: card_visibility');
    expect(err({ card_visibility: null })).not.toBeNull();
    expect(err({ voting_enabled: 'true' })).not.toBeNull();
    expect(err({ secret_voting: 1 })).not.toBeNull();
    expect(err({ board_locked: null })).not.toBeNull();
    expect(err({ max_votes_per_participant: 0 })).not.toBeNull();
    expect(err({ max_votes_per_participant: 2.5 })).not.toBeNull();
    expect(err({ max_votes_per_participant: 100 })).not.toBeNull();
    expect(err({ max_votes_per_participant: '5' })).not.toBeNull();
    expect(err({ highlighted_card_id: 5 })).not.toBeNull();
    expect(err({ highlighted_card_id: '' })).not.toBeNull();
    expect(err({ highlighted_card_id: 'x'.repeat(201) })).not.toBeNull();
  });

  it('accepts in-range values', () => {
    expect(validateSettingsPatch({ card_visibility: 'visible', max_votes_per_participant: 99, highlighted_card_id: 'abc' }).ok).toBe(true);
  });

  it('validates the timer object strictly', () => {
    const good = { duration: 300, remaining: 120, status: 'running', started_at: '2026-11-17T12:00:00.000Z' };
    expect(validateSettingsPatch({ timer: good }).ok).toBe(true);
    expect(err({ timer: { ...good, status: 'boom' } })).not.toBeNull();
    expect(err({ timer: { ...good, duration: -1 } })).not.toBeNull();
    expect(err({ timer: { ...good, remaining: Infinity } })).not.toBeNull();
    expect(err({ timer: { ...good, started_at: 'yesterday' } })).not.toBeNull();
    expect(err({ timer: { ...good, extra: 1 } })).not.toBeNull();
    expect(err({ timer: { duration: 1 } })).not.toBeNull();
    expect(err({ timer: 'idle' })).not.toBeNull();
    expect(err({ timer: null })).not.toBeNull();
  });

  it('max_votes_per_card is a whole number from 1 to 12', () => {
    for (const ok of [1, 3, 12]) expect(validateSettingsPatch({ max_votes_per_card: ok }).ok).toBe(true);
    for (const bad of [0, 13, 2.5, '3', null]) expect(validateSettingsPatch({ max_votes_per_card: bad }).ok).toBe(false);
  });
});
