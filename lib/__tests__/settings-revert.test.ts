import { describe, it, expect } from 'vitest';
import { revertSettingsPatch } from '@/lib/settingsRevert';
import { DEFAULT_BOARD_SETTINGS } from '@/utils/constants';
import type { BoardSettings } from '@/types';

const timer = (remaining: number) => ({ duration: 60, remaining, status: 'running' as const, started_at: null });
const base = { ...DEFAULT_BOARD_SETTINGS };

describe('revertSettingsPatch', () => {
  it('a plain failure restores the old values', () => {
    const patch = { voting_enabled: !base.voting_enabled, timer: timer(30) };
    const current = { id: 'b', title: 'T', settings: { ...base, ...patch } };
    const out = revertSettingsPatch(current, base, patch);
    expect(out.settings).toEqual(base);
  });

  it('a key someone else changed in the meantime is left alone', () => {
    const patch = { voting_enabled: true, board_locked: true };
    const current = { settings: { ...base, voting_enabled: true, board_locked: false } };
    const out = revertSettingsPatch(current, { ...base, voting_enabled: false, board_locked: false }, patch);
    expect(out.settings.voting_enabled).toBe(false);
    expect(out.settings.board_locked).toBe(false);
    const changed = { settings: { ...base, voting_enabled: false } };
    const out2 = revertSettingsPatch(changed, { ...base, voting_enabled: false }, { voting_enabled: true });
    expect(out2.settings.voting_enabled).toBe(false);
    const other = { settings: { ...base, card_visibility: 'hidden' as const } };
    const out3 = revertSettingsPatch(other, { ...base, card_visibility: 'visible' }, { card_visibility: 'revealed' as unknown as 'visible' });
    expect(out3.settings.card_visibility).toBe('hidden');
  });

  it('compares object values by content', () => {
    const patch = { timer: timer(30) };
    const current = { settings: { ...base, timer: timer(30) } };
    expect(revertSettingsPatch(current, base, patch).settings.timer).toEqual(base.timer);
    const moved = { settings: { ...base, timer: timer(10) } };
    expect(revertSettingsPatch(moved, base, patch).settings.timer).toEqual(timer(10));
  });

  it('fields outside settings changed in the meantime are preserved', () => {
    const patch = { timer: timer(30) };
    const current = {
      title: 'Renamed', phase: 'vote', archived_at: '2026-01-01', settings: { ...base, timer: timer(30) },
    };
    const out = revertSettingsPatch(current, base, patch);
    expect(out.title).toBe('Renamed');
    expect(out.phase).toBe('vote');
    expect(out.archived_at).toBe('2026-01-01');
    expect(out.settings.timer).toEqual(base.timer);
  });

  it('a key that did not exist before is removed again', () => {
    const before = { ...base } as Partial<BoardSettings>;
    delete before.timer;
    const patch = { timer: timer(30) };
    const current = { settings: { ...base, timer: timer(30) } as BoardSettings };
    const out = revertSettingsPatch(current, before as BoardSettings, patch);
    expect('timer' in out.settings).toBe(false);
  });

  it('does not mutate its inputs', () => {
    const patch = { voting_enabled: true };
    const current = { settings: { ...base, voting_enabled: true } };
    const snapshot = JSON.stringify(current);
    revertSettingsPatch(current, { ...base, voting_enabled: false }, patch);
    expect(JSON.stringify(current)).toBe(snapshot);
  });
});
