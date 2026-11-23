/** The Postgres error code of a rejected query (NeonDbError.code), or undefined for anything else. Never read the message or detail: they can carry row values. */
export function dbErrorCode(err: unknown): string | undefined {
  return typeof err === 'object' && err !== null ? (err as { code?: string }).code : undefined;
}

/** A foreign-key violation: a row the statement read was removed before its insert. */
export const FOREIGN_KEY_VIOLATION = '23503';
