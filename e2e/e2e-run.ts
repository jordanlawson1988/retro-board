import { neon } from '@neondatabase/serverless';

/** Title prefix of every board `createBoard` makes. */
export const E2E_TITLE_PREFIX = 'e2e ';
/** Address prefix and domain of every throwaway account a test creates. The domain is reserved and can never receive mail. */
export const E2E_USER_EMAIL_PREFIX = 'e2e-';
export const E2E_USER_EMAIL_DOMAIN = '@example.com';
/** Env var carrying this run's start time (ISO, from the database clock) to workers and teardown. */
export const RUN_START_ENV = 'E2E_RUN_STARTED_AT';

/** Same dev-only guard as the direct-SQL helpers in helpers.ts; returns the connection. */
export function devDb(who: string) {
  const url = process.env.DATABASE_URL ?? '';
  if (process.env.NEON_BRANCH !== 'dev') throw new Error(`${who} refuses to run unless NEON_BRANCH=dev`);
  if (url.includes('ep-delicate-star')) throw new Error(`${who} refuses to run against the production host`);
  return neon(url);
}
