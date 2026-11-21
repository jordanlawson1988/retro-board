import { createHmac, timingSafeEqual } from 'node:crypto';
import { UNSUBSCRIBE_TOKEN_PURPOSE } from './constants/email';

// Imports only node:crypto and a relative constants path so an end-to-end test can load it
// outside the Next alias resolution.

const KEY_CONTEXT = 'retroboard:email-unsubscribe:v1';

export function envSecret(): string {
  const secret = process.env.PARTICIPANT_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('PARTICIPANT_SESSION_SECRET is not set or too short');
  }
  return secret;
}

/** Derived key, so no unsubscribe signature can equal a participant session signature. */
function signature(userId: string, secret: string): string {
  const key = createHmac('sha256', secret).update(KEY_CONTEXT).digest();
  return createHmac('sha256', key).update(`${UNSUBSCRIBE_TOKEN_PURPOSE}\n${userId}`).digest('base64url');
}

/**
 * `userId.signature`. Binds the purpose and one account. It does not expire: a link in an old
 * email must keep working, and all it can do is turn summaries off.
 */
export function signUnsubscribeToken(userId: string, secret: string = envSecret()): string {
  if (!userId || /[\r\n]/.test(userId)) throw new Error('Invalid user id');
  return `${userId}.${signature(userId, secret)}`;
}

export function verifyUnsubscribeToken(token: unknown, secret: string = envSecret()): { userId: string } | null {
  if (typeof token !== 'string') return null;
  const dot = token.lastIndexOf('.');
  if (dot < 1) return null;
  const userId = token.slice(0, dot);
  const given = token.slice(dot + 1);
  if (!userId || !given || /[\r\n]/.test(userId)) return null;
  const expected = Buffer.from(signature(userId, secret));
  const actual = Buffer.from(given);
  if (expected.length !== actual.length) return null;
  if (!timingSafeEqual(expected, actual)) return null;
  return { userId };
}
