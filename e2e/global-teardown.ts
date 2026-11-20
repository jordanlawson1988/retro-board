import { devDb, E2E_TITLE_PREFIX, RUN_START_ENV } from './e2e-run';

/**
 * Delete the boards this run created: title `e2e <id>` (the exact form createBoard writes) and
 * created_at at or after the run start. Child rows cascade from boards. Earlier runs are left alone.
 */
export default async function globalTeardown() {
  const db = devDb('e2e globalTeardown');
  const startedAt = process.env[RUN_START_ENV];
  if (!startedAt) throw new Error('e2e globalTeardown: run start time missing, refusing to delete');
  const removed = await db`
    DELETE FROM boards
    WHERE created_at >= ${startedAt}::timestamptz
      AND title LIKE ${E2E_TITLE_PREFIX + '%'}
      AND title = ${E2E_TITLE_PREFIX} || id
    RETURNING id`;
  console.log(`e2e teardown: removed ${removed.length} board(s) created by this run`);
}
