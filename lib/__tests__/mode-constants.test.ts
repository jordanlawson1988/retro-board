import { describe, it, expect } from 'vitest';
import { BOARD_MODES, GUIDED_MODE, OPEN_MODE, isBoardMode } from '@/lib/constants/phases';

describe('mode constants', () => {
  it('are members of BOARD_MODES and distinct', () => {
    expect(BOARD_MODES).toContain(GUIDED_MODE);
    expect(BOARD_MODES).toContain(OPEN_MODE);
    expect(GUIDED_MODE).not.toBe(OPEN_MODE);
    expect(isBoardMode(GUIDED_MODE) && isBoardMode(OPEN_MODE)).toBe(true);
  });
  it('keep their wire values', () => {
    expect(OPEN_MODE).toBe('open');
    expect(GUIDED_MODE).toBe('guided');
  });
});
