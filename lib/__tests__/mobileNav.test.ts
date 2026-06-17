import { describe, it, expect } from 'vitest';
import { computeMobileNavActive } from '@/lib/mobileNav';

describe('computeMobileNavActive', () => {
  it('returns board when nothing is open', () => {
    expect(computeMobileNavActive({ moreOpen: false, actionsOpen: false })).toBe('board');
  });
  it('returns actions when the actions sheet is open', () => {
    expect(computeMobileNavActive({ moreOpen: false, actionsOpen: true })).toBe('actions');
  });
  it('returns more when the more sheet is open', () => {
    expect(computeMobileNavActive({ moreOpen: true, actionsOpen: false })).toBe('more');
  });
  it('prefers more over actions when both are open', () => {
    expect(computeMobileNavActive({ moreOpen: true, actionsOpen: true })).toBe('more');
  });
});
