import { SUMMARY_EMAIL_FEATURE } from '../lib/constants/features';
import { devDb, RUN_START_ENV } from './e2e-run';

/**
 * Force the summary_email flag off at the very start of every run (a killed earlier run can leave it
 * on; no row means zero rows touched), then record the run start using the database clock, so teardown
 * never compares against a skewed local clock.
 */
export default async function globalSetup() {
  const db = devDb('e2e globalSetup');
  await db`UPDATE feature_flags SET is_enabled = false WHERE key = ${SUMMARY_EMAIL_FEATURE}`;
  const [row] = await db`SELECT now() AS t`;
  process.env[RUN_START_ENV] = new Date(row.t as string).toISOString();
}
