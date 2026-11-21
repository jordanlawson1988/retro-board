import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { MAX_VOTES_PER_CARD_RANGE, OPEN_MAX_VOTES_PER_CARD } from '@/lib/constants/board-settings';
import { GROUP_TITLE_MAX } from '@/lib/constants/groups';

const sqlText = readFileSync('scripts/migrations/016_group_and_vote.sql', 'utf-8');

describe('016_group_and_vote.sql contract', () => {
  it('votes_count_range matches MAX_VOTES_PER_CARD_RANGE', () => {
    const m = /votes_count_range\s+CHECK\s*\(\s*count\s+BETWEEN\s+(\d+)\s+AND\s+(\d+)\s*\)/i.exec(sqlText);
    expect(m && [Number(m[1]), Number(m[2])]).toEqual([MAX_VOTES_PER_CARD_RANGE.min, MAX_VOTES_PER_CARD_RANGE.max]);
  });
  it('a new vote row defaults to the open-board count', () => {
    const m = /ADD COLUMN IF NOT EXISTS count SMALLINT NOT NULL DEFAULT (\d+)/i.exec(sqlText);
    expect(Number(m?.[1])).toBe(OPEN_MAX_VOTES_PER_CARD);
  });
  it('cards_group_title_length matches GROUP_TITLE_MAX', () => {
    const m = /char_length\(group_title\)\s*<=\s*(\d+)/i.exec(sqlText);
    expect(Number(m?.[1])).toBe(GROUP_TITLE_MAX);
  });
  it('is additive and transactional: no DROP, no ALTER COLUMN, BEGIN and COMMIT', () => {
    expect(sqlText).not.toMatch(/\bDROP\b|ALTER\s+COLUMN/i);
    expect(sqlText).toMatch(/^BEGIN;/m);
    expect(sqlText).toMatch(/^COMMIT;/m);
  });
});
