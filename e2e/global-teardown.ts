import { SUMMARY_EMAIL_FEATURE } from '../lib/constants/features';
import { devDb, E2E_TITLE_PREFIX, E2E_USER_EMAIL_DOMAIN, E2E_USER_EMAIL_PREFIX, RUN_START_ENV } from './e2e-run';

/**
 * Delete the boards this run created: title `e2e <id>` (the exact form createBoard writes) and
 * created_at at or after the run start. Child rows cascade from boards. Earlier runs are left alone.
 * Then the throwaway accounts: an e2e address on the reserved domain AND created at or after the run
 * start, so an account that existed before the run can never match. Their preferences and send rows
 * cascade. Last, the summary_email flag is forced off so an interrupted run cannot leave it on.
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

  const users = await db`
    DELETE FROM "user"
    WHERE email LIKE ${E2E_USER_EMAIL_PREFIX + '%' + E2E_USER_EMAIL_DOMAIN}
      AND "createdAt" >= ${startedAt}::timestamptz
    RETURNING id`;
  console.log(`e2e teardown: removed ${users.length} throwaway account(s) created by this run`);

  const flags = await db`UPDATE feature_flags SET is_enabled = false WHERE key = ${SUMMARY_EMAIL_FEATURE} RETURNING key`;
  console.log(`e2e teardown: summary_email flag forced off (${flags.length} row)`);
}
