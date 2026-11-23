import { describe, it, expect, afterEach, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { signUnsubscribeToken, verifyUnsubscribeToken } from '../email-unsubscribe';

const S = 'test-secret-test-secret-test-secret-0123';
const OTHER = 'other-secret-other-secret-other-secret-9';

afterEach(() => vi.unstubAllEnvs());

describe('unsubscribe token', () => {
  it('round-trips a user id', () => {
    expect(verifyUnsubscribeToken(signUnsubscribeToken('u1', S), S)).toEqual({ userId: 'u1' });
  });
  it('rejects a token whose user id was edited', () => {
    const sig = signUnsubscribeToken('u1', S).slice('u1.'.length);
    expect(verifyUnsubscribeToken(`u2.${sig}`, S)).toBeNull();
  });
  it('rejects a changed last signature character', () => {
    const t = signUnsubscribeToken('u1', S);
    const last = t.slice(-1);
    expect(verifyUnsubscribeToken(t.slice(0, -1) + (last === 'A' ? 'B' : 'A'), S)).toBeNull();
  });
  it('rejects a token signed with another secret', () => {
    expect(verifyUnsubscribeToken(signUnsubscribeToken('u1', OTHER), S)).toBeNull();
  });
  it('rejects malformed input without throwing', () => {
    for (const bad of ['', 'abc', '.sig', 'u1.', 5, null, undefined, {}, 'u1.short', `u1.${'A'.repeat(500)}`]) {
      expect(verifyUnsubscribeToken(bad, S)).toBeNull();
    }
  });
  it('rejects a forged token built from a guessed signature', () => {
    expect(verifyUnsubscribeToken(`u1.${'A'.repeat(43)}`, S)).toBeNull();
  });
  it('refuses to sign an empty id or one with a newline', () => {
    expect(() => signUnsubscribeToken('a\nb', S)).toThrow();
    expect(() => signUnsubscribeToken('', S)).toThrow();
  });
  it('a user id containing a dot round-trips', () => {
    expect(verifyUnsubscribeToken(signUnsubscribeToken('a.b', S), S)).toEqual({ userId: 'a.b' });
  });
  it('a token for a.b does not verify as a', () => {
    const sig = signUnsubscribeToken('a.b', S).slice('a.b.'.length);
    expect(verifyUnsubscribeToken(`a.${sig}`, S)).toBeNull();
    expect(verifyUnsubscribeToken(`b.${sig}`, S)).toBeNull();
  });
  it('two users get different tokens; the same user and secret give the same token', () => {
    expect(signUnsubscribeToken('u1', S)).not.toBe(signUnsubscribeToken('u2', S));
    expect(signUnsubscribeToken('u1', S)).toBe(signUnsubscribeToken('u1', S));
  });
  it('uses a derived key, not the raw secret', () => {
    const sig = signUnsubscribeToken('u1', S).slice('u1.'.length);
    expect(sig).not.toBe(createHmac('sha256', S).update('summary_email\nu1').digest('base64url'));
  });
  it('the default secret comes from PARTICIPANT_SESSION_SECRET and must be 32 characters', () => {
    vi.stubEnv('PARTICIPANT_SESSION_SECRET', 'short-secret');
    expect(() => signUnsubscribeToken('u1')).toThrow('PARTICIPANT_SESSION_SECRET is not set or too short');
    expect(() => verifyUnsubscribeToken('u1.x')).toThrow('PARTICIPANT_SESSION_SECRET is not set or too short');
    vi.stubEnv('PARTICIPANT_SESSION_SECRET', S);
    expect(verifyUnsubscribeToken(signUnsubscribeToken('u1'))).toEqual({ userId: 'u1' });
  });
});
