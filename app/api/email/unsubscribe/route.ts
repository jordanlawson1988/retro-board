import { NextResponse } from 'next/server';
import { rateLimitOr429 } from '@/lib/rate-limit';
import { verifyUnsubscribeToken } from '@/lib/email-unsubscribe';
import { setSummaryPreference } from '@/lib/email-preferences';
import { UNSUBSCRIBE_INVALID, UNSUBSCRIBE_PAGE_PATH, UNSUBSCRIBE_RATE_LIMIT } from '@/lib/constants/email';

// One-click unsubscribe (RFC 8058). Authenticated by the signed token in the query string
// alone: the request body is never read. It does not check the feature flag, so a link in an
// old email keeps working after the flag is turned off. A valid token exists only in an email
// this feature sent, so the write never runs on a database without email_preferences.

const tokenFrom = (request: Request) => new URL(request.url).searchParams.get('token');

export async function POST(request: Request) {
  const limited = await rateLimitOr429(request, UNSUBSCRIBE_RATE_LIMIT.key, UNSUBSCRIBE_RATE_LIMIT.limit, UNSUBSCRIBE_RATE_LIMIT.window);
  if (limited) return limited;

  const verified = verifyUnsubscribeToken(tokenFrom(request));
  if (!verified) return NextResponse.json({ error: UNSUBSCRIBE_INVALID }, { status: 400 });

  // Same answer whether or not the account still exists: the write is a no-op for a missing one.
  await setSummaryPreference(verified.userId, false);
  return NextResponse.json({ ok: true });
}

/**
 * A mail scanner or a person following the link lands on the page. Nothing is written.
 * The Location is a relative path built from the constant page path and the encoded token,
 * so no header or user-supplied URL can choose where it points.
 */
export async function GET(request: Request) {
  const token = tokenFrom(request);
  const location = token ? `${UNSUBSCRIBE_PAGE_PATH}?token=${encodeURIComponent(token)}` : UNSUBSCRIBE_PAGE_PATH;
  return new Response(null, { status: 303, headers: { location } });
}
