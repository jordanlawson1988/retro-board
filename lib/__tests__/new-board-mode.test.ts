import { describe, it, expect } from 'vitest';
import { validateNewBoard } from '@/lib/board-validation';

const base = {
  id: 'abcdefghij',
  title: 'T',
  description: null,
  template: 'start-stop-continue',
  settings: { card_visibility: 'hidden' },
  columns: [{ id: 'col1234567', title: 'C', description: null, color: '#cccccc', position: 0 }],
  participant: { displayName: 'Ann' },
};

function modeOf(body: Record<string, unknown>) {
  const r = validateNewBoard(body);
  if (!r.ok) throw new Error(r.error);
  return r.value.mode;
}

describe('validateNewBoard mode', () => {
  it('defaults to open when mode is absent', () => {
    expect(modeOf(base)).toBe('open');
  });

  it('accepts open and guided', () => {
    expect(modeOf({ ...base, mode: 'open' })).toBe('open');
    expect(modeOf({ ...base, mode: 'guided' })).toBe('guided');
  });

  it('rejects any other value with Invalid mode', () => {
    for (const mode of ['party', '', 'GUIDED', null, 1, true, {}, ['guided']]) {
      expect(validateNewBoard({ ...base, mode })).toEqual({ ok: false, error: 'Invalid mode' });
    }
  });
});
