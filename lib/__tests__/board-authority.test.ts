import { describe, it, expect } from 'vitest';
import { resolveBoardAuthority } from '@/lib/auth-helpers';

const base = {
  userId: 'u1',
  ownerId: null as string | null,
  memberRole: null as string | null,
  isSystemAdmin: false,
};

describe('resolveBoardAuthority', () => {
  it('owner can facilitate and is owner', () => {
    expect(resolveBoardAuthority({ ...base, ownerId: 'u1' })).toEqual({
      isOwner: true,
      canFacilitate: true,
      isSystemAdmin: false,
    });
  });
  it('facilitator member can facilitate but is not owner', () => {
    expect(resolveBoardAuthority({ ...base, memberRole: 'facilitator' })).toEqual({
      isOwner: false,
      canFacilitate: true,
      isSystemAdmin: false,
    });
  });
  it('participant member cannot facilitate', () => {
    expect(resolveBoardAuthority({ ...base, memberRole: 'participant' }).canFacilitate).toBe(false);
  });
  it('viewer member cannot facilitate', () => {
    expect(resolveBoardAuthority({ ...base, memberRole: 'viewer' }).canFacilitate).toBe(false);
  });
  it('system admin can facilitate (covers legacy null-owner boards)', () => {
    expect(resolveBoardAuthority({ ...base, isSystemAdmin: true }).canFacilitate).toBe(true);
  });
  it('non-member has no authority', () => {
    expect(resolveBoardAuthority(base)).toEqual({
      isOwner: false,
      canFacilitate: false,
      isSystemAdmin: false,
    });
  });
  it('a different owner id does not make this user the owner', () => {
    expect(resolveBoardAuthority({ ...base, ownerId: 'someone-else' }).isOwner).toBe(false);
  });
});
