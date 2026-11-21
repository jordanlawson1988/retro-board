/** Decisions for the summary email screens, kept pure so they can be tested without a DOM. */

export type UnsubscribeOutcome = 'done' | 'invalid' | 'failed';

/** What an answer from POST /api/email/unsubscribe means for the page. */
export function unsubscribeOutcome(status: number): UnsubscribeOutcome {
  if (status === 200) return 'done';
  if (status === 400) return 'invalid';
  return 'failed';
}

/** The stored setting from a GET or POST /api/user/email-preferences answer, or null when there is none to show. */
export function preferenceFromResponse(status: number, body: unknown): boolean | null {
  if (status !== 200) return null;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const value = (body as { summaryEmail?: unknown }).summaryEmail;
  return typeof value === 'boolean' ? value : null;
}

/** The token from a search param: a single non-empty string, else null. */
export function tokenFromSearchParam(v: string | string[] | undefined): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}
