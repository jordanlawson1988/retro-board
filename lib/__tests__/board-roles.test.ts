import { describe, it, expect } from 'vitest';
import { BOARD_MEMBER_ROLES, isBoardMemberRole } from '@/types';

describe('board roles SSOT', () => {
  it('matches the SQL CHECK set exactly', () => {
    expect([...BOARD_MEMBER_ROLES]).toEqual(['facilitator', 'participant', 'viewer']);
  });
  it('isBoardMemberRole guards membership', () => {
    expect(isBoardMemberRole('facilitator')).toBe(true);
    // ownership is boards.owner_id only; 'owner' is not a storable member role
    expect(isBoardMemberRole('owner')).toBe(false);
    expect(isBoardMemberRole('admin')).toBe(false);
    expect(isBoardMemberRole('')).toBe(false);
    expect(isBoardMemberRole(null)).toBe(false);
    expect(isBoardMemberRole(42)).toBe(false);
  });
});
