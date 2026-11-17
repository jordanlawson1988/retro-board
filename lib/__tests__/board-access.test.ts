import { describe, it, expect } from 'vitest';
import { decideBoardAccess, type BoardAccessInput } from '@/lib/board-access';

const none: BoardAccessInput = {
  archived: false,
  hasParticipantRow: false,
  userMatchedParticipant: false,
  userIsOwner: false,
  userIsMember: false,
  userIsSystemAdmin: false,
};

describe('decideBoardAccess', () => {
  describe('active board', () => {
    it('a stranger is open but cannot see joined-only data; may join', () => {
      expect(decideBoardAccess(none)).toEqual({ access: 'open', canViewDetail: false, canJoin: true });
    });
    it('a participant row sees detail', () => {
      expect(decideBoardAccess({ ...none, hasParticipantRow: true }).canViewDetail).toBe(true);
    });
    it.each(['userMatchedParticipant', 'userIsOwner', 'userIsMember', 'userIsSystemAdmin'] as const)(
      'signed-in standing %s sees detail',
      (k) => {
        expect(decideBoardAccess({ ...none, [k]: true }).canViewDetail).toBe(true);
      }
    );
  });

  describe('completed board', () => {
    const done = { ...none, archived: true };
    it('a stranger is closed out: no detail, no join', () => {
      expect(decideBoardAccess(done)).toEqual({ access: 'completed-closed', canViewDetail: false, canJoin: false });
    });
    it('a participant row can view and re-establish their session', () => {
      expect(decideBoardAccess({ ...done, hasParticipantRow: true })).toEqual({
        access: 'open',
        canViewDetail: true,
        canJoin: true,
      });
    });
    it('a user matched to a participant row can view and rejoin', () => {
      expect(decideBoardAccess({ ...done, userMatchedParticipant: true })).toEqual({
        access: 'open',
        canViewDetail: true,
        canJoin: true,
      });
    });
    it.each(['userIsOwner', 'userIsMember', 'userIsSystemAdmin'] as const)(
      '%s can view but cannot create a participant',
      (k) => {
        expect(decideBoardAccess({ ...done, [k]: true })).toEqual({
          access: 'open',
          canViewDetail: true,
          canJoin: false,
        });
      }
    );
  });
});
