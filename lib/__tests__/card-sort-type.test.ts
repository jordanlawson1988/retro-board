import { describe, it, expect } from 'vitest';
import { isCardSort, CARD_SORT_OPTIONS } from '@/types';

describe('isCardSort', () => {
  it('accepts each value in CARD_SORT_OPTIONS', () => {
    for (const v of CARD_SORT_OPTIONS) {
      expect(isCardSort(v)).toBe(true);
    }
  });

  it('rejects unknown strings, null, undefined, and non-strings', () => {
    expect(isCardSort('votes')).toBe(false);
    expect(isCardSort('manual ')).toBe(false);
    expect(isCardSort('')).toBe(false);
    expect(isCardSort(null)).toBe(false);
    expect(isCardSort(undefined)).toBe(false);
    expect(isCardSort(0)).toBe(false);
    expect(isCardSort({})).toBe(false);
  });

  it('exposes the three expected options', () => {
    expect([...CARD_SORT_OPTIONS]).toEqual(['votes_desc', 'votes_asc', 'manual']);
  });
});
