import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextResponse } from 'next/server';

export const PARTICIPANT_SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 90;

function getSecret(): string {
  const secret = process.env.PARTICIPANT_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('PARTICIPANT_SESSION_SECRET is not set or too short');
  }
  return secret;
}

function sign(boardId: string, participantId: string, issuedAtSec: number): string {
  return createHmac('sha256', getSecret())
    .update(`${boardId}.${participantId}.${issuedAtSec}`)
    .digest('base64url');
}

export function cookieNameFor(boardId: string): string {
  return `rb_ps_${boardId}`;
}

export function signParticipantSession(
  boardId: string,
  participantId: string,
  nowSec: number = Math.floor(Date.now() / 1000)
): string {
  return `${participantId}.${nowSec}.${sign(boardId, participantId, nowSec)}`;
}

export function verifyParticipantSession(
  boardId: string,
  token: string | null | undefined,
  nowSec: number = Math.floor(Date.now() / 1000)
): { participantId: string } | null {
  // Read the secret first so a misconfigured server fails loudly, not as "no session".
  getSecret();
  if (!token) return null;

  // Parse from the right: the signature and timestamp never contain dots.
  const sigDot = token.lastIndexOf('.');
  if (sigDot <= 0) return null;
  const iatDot = token.lastIndexOf('.', sigDot - 1);
  if (iatDot <= 0) return null;

  const participantId = token.slice(0, iatDot);
  const iatStr = token.slice(iatDot + 1, sigDot);
  const sig = token.slice(sigDot + 1);
  if (!participantId || !sig || !/^\d+$/.test(iatStr)) return null;

  const issuedAt = Number(iatStr);
  if (!Number.isSafeInteger(issuedAt)) return null;
  if (nowSec - issuedAt > PARTICIPANT_SESSION_MAX_AGE_SEC) return null;
  // A token from the future is not valid either.
  if (issuedAt > nowSec + 60) return null;

  const expected = Buffer.from(sign(boardId, participantId, issuedAt));
  const given = Buffer.from(sig);
  if (expected.length !== given.length) return null;
  if (!timingSafeEqual(expected, given)) return null;

  return { participantId };
}

export function readParticipantId(request: Request, boardId: string): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  const name = cookieNameFor(boardId);
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    let value = part.slice(eq + 1).trim();
    try {
      value = decodeURIComponent(value);
    } catch {
      return null;
    }
    return verifyParticipantSession(boardId, value)?.participantId ?? null;
  }
  return null;
}

export function setParticipantCookie(
  response: NextResponse,
  boardId: string,
  participantId: string
): void {
  response.cookies.set(cookieNameFor(boardId), signParticipantSession(boardId, participantId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: PARTICIPANT_SESSION_MAX_AGE_SEC,
  });
}
