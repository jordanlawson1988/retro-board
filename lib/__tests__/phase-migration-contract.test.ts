import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { BOARD_MODES, PHASE_IDS } from '@/lib/constants/phases';

const sqlText = readFileSync('scripts/migrations/015_guided_mode.sql', 'utf-8');
const listIn = (constraint: string) =>
  [...(new RegExp(`${constraint}[\\s\\S]*?\\(([^;]*?)\\)\\s*\\)`).exec(sqlText)?.[1] ?? '').matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);

describe('015_guided_mode.sql vocabulary contract', () => {
  it('boards_mode_check lists exactly BOARD_MODES', () => {
    expect(listIn('boards_mode_check').sort()).toEqual([...BOARD_MODES].sort());
  });
  it('boards_phase_check lists exactly PHASE_IDS', () => {
    expect(listIn('boards_phase_check').sort()).toEqual([...PHASE_IDS].sort());
  });
  it('is additive: no DROP and no ALTER COLUMN', () => {
    expect(sqlText).not.toMatch(/\bDROP\b|ALTER\s+COLUMN/i);
  });
});
