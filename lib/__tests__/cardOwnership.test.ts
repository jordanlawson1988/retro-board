import { describe, it, expect } from 'vitest';
import { isMine } from '@/utils/isMine';
import { exportCardText, displayCardText, HIDDEN_CARD_PLACEHOLDER, hiddenCardPlaceholder } from '@/utils/cardText';
import { BOARD_MODES, FIRST_PHASE, GUIDED_MODE, OPEN_MODE, PHASES } from '@/lib/constants/phases';
import type { Card } from '@/types';

const base: Card = {
  id: 'c1', column_id: 'col', board_id: 'b', text: 'hello', author_name: 'A', author_id: 'p1',
  color: null, position: 0, merged_with: null, reactions: {},
  created_at: '2026-11-16T00:00:00Z', updated_at: '2026-11-16T00:00:00Z',
};

describe('isMine', () => {
  it('trusts the server flag when present, whatever the author id says', () => {
    expect(isMine({ ...base, is_mine: true, author_id: null }, 'p2')).toBe(true);
    expect(isMine({ ...base, is_mine: false, author_id: 'p1' }, 'p1')).toBe(false);
  });
  it('falls back to author id when the flag is missing (v1 boards, old cards)', () => {
    expect(isMine(base, 'p1')).toBe(true);
    expect(isMine(base, 'p2')).toBe(false);
  });
  it('is false for a withheld author or no current participant', () => {
    expect(isMine({ ...base, author_id: null }, 'p1')).toBe(false);
    expect(isMine({ ...base, author_id: null }, null)).toBe(false);
    expect(isMine(base, null)).toBe(false);
  });
});

describe('exportCardText', () => {
  it('writes [hidden] for withheld cards, never an empty string', () => {
    expect(exportCardText({ ...base, text: '', text_hidden: true })).toBe('[hidden]');
  });
  it('passes visible text through', () => {
    expect(exportCardText(base)).toBe('hello');
  });
});

describe('displayCardText', () => {
  it('shows the placeholder, never an empty string, for withheld text', () => {
    expect(displayCardText({ ...base, text: '', text_hidden: true })).toBe(HIDDEN_CARD_PLACEHOLDER);
    expect(HIDDEN_CARD_PLACEHOLDER.length).toBeGreaterThan(0);
  });
  it('passes visible text through', () => {
    expect(displayCardText(base)).toBe('hello');
  });
});

describe('hidden card wording by board mode', () => {
  const hidden = { ...base, text: '', text_hidden: true };

  it('a guided board says the text is hidden until the first phase ends, using the phase label', () => {
    expect(hiddenCardPlaceholder(GUIDED_MODE)).toBe('Hidden until Reflect ends');
    expect(hiddenCardPlaceholder(GUIDED_MODE)).toBe(`Hidden until ${PHASES[FIRST_PHASE].label} ends`);
    expect(displayCardText(hidden, GUIDED_MODE)).toBe('Hidden until Reflect ends');
  });
  it('an open board keeps the original wording', () => {
    expect(hiddenCardPlaceholder(OPEN_MODE)).toBe('Hidden until the facilitator reveals cards');
    expect(displayCardText(hidden, OPEN_MODE)).toBe('Hidden until the facilitator reveals cards');
  });
  it('an unknown mode reads as open: omitted, undefined, null', () => {
    expect(displayCardText(hidden)).toBe(HIDDEN_CARD_PLACEHOLDER);
    expect(displayCardText(hidden, undefined)).toBe(HIDDEN_CARD_PLACEHOLDER);
    expect(displayCardText(hidden, null)).toBe(HIDDEN_CARD_PLACEHOLDER);
  });
  it('a card whose text is not hidden returns its own text in every mode', () => {
    for (const mode of BOARD_MODES) expect(displayCardText(base, mode)).toBe('hello');
    expect(displayCardText(base)).toBe('hello');
    expect(displayCardText(base, null)).toBe('hello');
  });
});
