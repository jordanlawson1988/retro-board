import { NextResponse } from 'next/server';
import { rateLimitOr429 } from '@/lib/rate-limit';
import { getFreshSession, getSessionOrNull } from '@/lib/auth-helpers';
import { canUse } from '@/lib/can-use';
import { SUMMARY_EMAIL_FEATURE } from '@/lib/constants/features';
import { EMAIL_PREFS_RATE_LIMIT, NOT_FOUND_ERROR, SIGN_IN_REQUIRED_ERROR } from '@/lib/constants/email';
import { readJsonObject } from '@/lib/request-body';
import { INVALID_BODY } from '@/lib/board-validation';
import { readSummaryPreference, setSummaryPreference } from '@/lib/email-preferences';

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

// The signed-in account's summary email setting. The user id comes only from the session.
// With the flag off both methods answer 404 before any statement names email_preferences,
// which production does not have until migration 018 is applied.

export async function GET() {
  const session = await getSessionOrNull();
  const userId = session?.user?.id;
  if (!userId) return fail(SIGN_IN_REQUIRED_ERROR, 401);
  if (!(await canUse(SUMMARY_EMAIL_FEATURE, userId))) return fail(NOT_FOUND_ERROR, 404);
  return NextResponse.json({ summaryEmail: await readSummaryPreference(userId) });
}

export async function POST(request: Request) {
  const limited = await rateLimitOr429(request, EMAIL_PREFS_RATE_LIMIT.key, EMAIL_PREFS_RATE_LIMIT.limit, EMAIL_PREFS_RATE_LIMIT.window);
  if (limited) return limited;

  const body = await readJsonObject(request);
  const summaryEmail = body?.summaryEmail;
  if (typeof summaryEmail !== 'boolean') return fail(INVALID_BODY, 400);

  const session = await getFreshSession();
  const userId = session?.user?.id;
  if (!userId) return fail(SIGN_IN_REQUIRED_ERROR, 401);
  if (!(await canUse(SUMMARY_EMAIL_FEATURE, userId))) return fail(NOT_FOUND_ERROR, 404);

  await setSummaryPreference(userId, summaryEmail);
  return NextResponse.json({ summaryEmail });
}
