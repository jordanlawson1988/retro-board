import { describe, it, expect } from 'vitest';
import { generateJoinCode, isValidJoinCode } from '@/lib/join-code';

describe('join-code', () => {
  it('generates a 5-char zero-padded numeric string', () => {
    for (let i = 0; i < 500; i++) {
      expect(generateJoinCode()).toMatch(/^\d{5}$/);
    }
  });
  it('validates format', () => {
    expect(isValidJoinCode('01234')).toBe(true);
    expect(isValidJoinCode('99999')).toBe(true);
    expect(isValidJoinCode('1234')).toBe(false);
    expect(isValidJoinCode('123456')).toBe(false);
    expect(isValidJoinCode('abcde')).toBe(false);
    expect(isValidJoinCode(12345 as unknown as string)).toBe(false);
    expect(isValidJoinCode(null)).toBe(false);
  });
});
