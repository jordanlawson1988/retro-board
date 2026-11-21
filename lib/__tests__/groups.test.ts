import { describe, it, expect } from 'vitest';
import {
  isLeadCard,
  visibleGroupTitle,
  validateGroupTitle,
  ungroupAll,
  hasGrouping,
  clampGroupTitle,
  groupTitleLength,
  showTitleCounter,
  editorStillOpen,
} from '@/lib/groups';
import { GROUP_TITLE_MAX, GROUP_TITLE_COUNTER_FROM } from '@/lib/constants/groups';

const cards = [
  { id: 'a', merged_with: null, group_title: 'Release pain' },
  { id: 'b', merged_with: 'a', group_title: null },
  { id: 'c', merged_with: null, group_title: 'Dormant' },
];

describe('groups', () => {
  it('a lead card has no parent and at least one child', () => {
    expect(isLeadCard('a', cards)).toBe(true);
    expect(isLeadCard('b', cards)).toBe(false);
    expect(isLeadCard('c', cards)).toBe(false);
    expect(isLeadCard('zz', cards)).toBe(false);
  });
  it('a title shows only on a lead card; a dormant one stays hidden', () => {
    expect(visibleGroupTitle('a', cards)).toBe('Release pain');
    expect(visibleGroupTitle('c', cards)).toBeNull();
  });
  it('validates: trims, empty clears, 80 code points max', () => {
    expect(validateGroupTitle(null)).toEqual({ ok: true, value: null });
    expect(validateGroupTitle('  Deploys  ')).toEqual({ ok: true, value: 'Deploys' });
    expect(validateGroupTitle('   ')).toEqual({ ok: true, value: null });
    expect(validateGroupTitle('😀'.repeat(80))).toEqual({ ok: true, value: '😀'.repeat(80) });
    expect(validateGroupTitle('x'.repeat(81))).toEqual({ ok: false, error: 'Group title must be at most 80 characters' });
    expect(validateGroupTitle(42)).toEqual({ ok: false, error: 'Invalid group title' });
  });
  it('ungroupAll clears every parent and title; hasGrouping sees either', () => {
    expect(ungroupAll(cards).every((c) => c.merged_with === null && c.group_title === null)).toBe(true);
    expect(hasGrouping(cards)).toBe(true);
    expect(hasGrouping(ungroupAll(cards))).toBe(false);
  });
});

describe('group title editor logic', () => {
  it('counts code points, so one emoji is one', () => {
    expect(groupTitleLength('Deploys')).toBe(7);
    expect(groupTitleLength('😀')).toBe(1);
    expect(groupTitleLength('')).toBe(0);
  });
  it('clamps to the maximum in code points and never splits an emoji', () => {
    const short = 'Deploys';
    expect(clampGroupTitle(short)).toBe(short);
    expect(clampGroupTitle('a'.repeat(GROUP_TITLE_MAX + 1))).toBe('a'.repeat(GROUP_TITLE_MAX));
    expect(clampGroupTitle('😀'.repeat(GROUP_TITLE_MAX + 5))).toBe('😀'.repeat(GROUP_TITLE_MAX));
    expect([...clampGroupTitle('😀'.repeat(GROUP_TITLE_MAX + 1))].length).toBe(GROUP_TITLE_MAX);
  });
  it('shows the counter once the length is past the threshold', () => {
    expect(showTitleCounter('a'.repeat(GROUP_TITLE_COUNTER_FROM))).toBe(false);
    expect(showTitleCounter('a'.repeat(GROUP_TITLE_COUNTER_FROM + 1))).toBe(true);
    expect(showTitleCounter('😀'.repeat(GROUP_TITLE_COUNTER_FROM + 1))).toBe(true);
  });
  it('an editor stays open only in the phase it was opened in, and only while editing is allowed', () => {
    expect(editorStillOpen('group', 'group', true)).toBe(true);
    expect(editorStillOpen('group', 'vote', true)).toBe(false);
    expect(editorStillOpen('group', null, true)).toBe(false);
    expect(editorStillOpen('group', 'group', false)).toBe(false);
  });
});
