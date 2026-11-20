/**
 * True for a Postgres unique violation (23505) on one of the named constraints.
 * The Neon driver exposes the violated constraint as `NeonDbError.constraint`.
 */
export function isUniqueViolation(err: unknown, constraints: readonly string[]): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { code?: unknown; constraint?: unknown };
  return e.code === '23505' && typeof e.constraint === 'string' && constraints.includes(e.constraint);
}
