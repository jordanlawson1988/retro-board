import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import {
  PARTICIPANT_SESSION_MAX_AGE_SEC,
  cookieNameFor,
  signParticipantSession,
  verifyParticipantSession,
  readParticipantId,
  setParticipantCookie,
} from '@/lib/participant-session';
import { NextResponse } from 'next/server';

const SECRET = 'test-secret-that-is-at-least-32-characters-long';

beforeAll(() => {
  process.env.PARTICIPANT_SESSION_SECRET = SECRET;
});

afterEach(() => {
  process.env.PARTICIPANT_SESSION_SECRET = SECRET;
});

describe('participant session token', () => {
  it('round-trips', () => {
    expect(verifyParticipantSession('b1', signParticipantSession('b1', 'p1'))).toEqual({
      participantId: 'p1',
    });
  });

  it('rejects another board', () => {
    expect(verifyParticipantSession('b2', signParticipantSession('b1', 'p1'))).toBeNull();
  });

  it('rejects tampering with the signature', () => {
    const token = signParticipantSession('b1', 'p1');
    const last = token.slice(-1);
    const flipped = token.slice(0, -1) + (last === 'A' ? 'B' : 'A');
    expect(verifyParticipantSession('b1', flipped)).toBeNull();
  });

  it('rejects a replaced participant id segment', () => {
    const token = signParticipantSession('b1', 'p1');
    const forged = 'p2' + token.slice('p1'.length);
    expect(verifyParticipantSession('b1', forged)).toBeNull();
  });

  it('rejects expiry', () => {
    const token = signParticipantSession('b1', 'p1', 1000);
    expect(
      verifyParticipantSession('b1', token, 1000 + PARTICIPANT_SESSION_MAX_AGE_SEC + 1)
    ).toBeNull();
  });

  it('accepts a token right at the expiry boundary', () => {
    const token = signParticipantSession('b1', 'p1', 1000);
    expect(
      verifyParticipantSession('b1', token, 1000 + PARTICIPANT_SESSION_MAX_AGE_SEC)
    ).toEqual({ participantId: 'p1' });
  });

  it('rejects garbage', () => {
    expect(verifyParticipantSession('b1', undefined)).toBeNull();
    expect(verifyParticipantSession('b1', null)).toBeNull();
    expect(verifyParticipantSession('b1', '')).toBeNull();
    expect(verifyParticipantSession('b1', 'a.b')).toBeNull();
    expect(verifyParticipantSession('b1', 'a.notanumber.c')).toBeNull();
  });

  it('rejects a token signed with a different secret', () => {
    const token = signParticipantSession('b1', 'p1');
    process.env.PARTICIPANT_SESSION_SECRET = 'another-secret-that-is-at-least-32-chars';
    expect(verifyParticipantSession('b1', token)).toBeNull();
  });

  it('names the cookie per board', () => {
    expect(cookieNameFor('b1')).toBe('rb_ps_b1');
  });

  it('reads the cookie header', () => {
    const token = signParticipantSession('b1', 'p1');
    const req = new Request('http://localhost/x', {
      headers: { Cookie: `other=1; rb_ps_b1=${token}` },
    });
    expect(readParticipantId(req, 'b1')).toBe('p1');
    expect(readParticipantId(req, 'b2')).toBeNull();
  });

  it('returns null when there is no cookie header', () => {
    expect(readParticipantId(new Request('http://localhost/x'), 'b1')).toBeNull();
  });

  it('returns null for a cookie signed for another board', () => {
    const token = signParticipantSession('b2', 'p1');
    const req = new Request('http://localhost/x', { headers: { Cookie: `rb_ps_b1=${token}` } });
    expect(readParticipantId(req, 'b1')).toBeNull();
  });

  it('sets an httpOnly lax cookie that reads back', () => {
    const res = NextResponse.json({ ok: true });
    setParticipantCookie(res, 'b1', 'p1');
    const cookie = res.cookies.get('rb_ps_b1');
    expect(cookie).toBeDefined();
    expect(verifyParticipantSession('b1', cookie!.value)).toEqual({ participantId: 'p1' });
    const header = res.headers.get('set-cookie') ?? '';
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/SameSite=lax/i);
    expect(header).toMatch(/Path=\//);
    expect(header).toContain(`Max-Age=${PARTICIPANT_SESSION_MAX_AGE_SEC}`);
  });

  it('throws without a secret', () => {
    delete process.env.PARTICIPANT_SESSION_SECRET;
    expect(() => signParticipantSession('b1', 'p1')).toThrow(
      'PARTICIPANT_SESSION_SECRET is not set or too short'
    );
    expect(() => verifyParticipantSession('b1', 'a.1.c')).toThrow(
      'PARTICIPANT_SESSION_SECRET is not set or too short'
    );
  });

  it('throws with a too-short secret', () => {
    process.env.PARTICIPANT_SESSION_SECRET = 'short';
    expect(() => signParticipantSession('b1', 'p1')).toThrow(
      'PARTICIPANT_SESSION_SECRET is not set or too short'
    );
  });
});
