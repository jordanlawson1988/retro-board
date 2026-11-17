import { generateJoinCode } from '@/lib/join-code';

export const JOIN_CODE_MAX_ATTEMPTS = 10;
const JOIN_CODE_CONSTRAINT = 'uq_boards_join_code';

/**
 * True for a Postgres unique violation (23505) on the join-code constraint only.
 * The Neon driver exposes the violated constraint as `error.constraint`. A 23505 from
 * another constraint (e.g. `boards_pkey` for a duplicate board id) is not a join-code collision.
 */
export function isJoinCodeCollision(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { code?: unknown; constraint?: unknown };
  return e.code === '23505' && e.constraint === JOIN_CODE_CONSTRAINT;
}

/**
 * Generate a join code and run `write(code)`; on a join-code collision retry with a fresh code,
 * up to JOIN_CODE_MAX_ATTEMPTS. Any other error is rethrown immediately. Returns the code that
 * was written. When attempts run out, the last collision error is thrown.
 */
export async function withJoinCodeRetry(
  write: (joinCode: string) => Promise<unknown>,
  generate: () => string = generateJoinCode
): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < JOIN_CODE_MAX_ATTEMPTS; attempt++) {
    const joinCode = generate();
    try {
      await write(joinCode);
      return joinCode;
    } catch (err) {
      if (!isJoinCodeCollision(err)) throw err;
      lastErr = err;
    }
  }
  throw lastErr;
}
