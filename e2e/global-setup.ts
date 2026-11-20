import { devDb, RUN_START_ENV } from './e2e-run';

/** Record the run start using the database clock, so teardown never compares against a skewed local clock. */
export default async function globalSetup() {
  const db = devDb('e2e globalSetup');
  const [row] = await db`SELECT now() AS t`;
  process.env[RUN_START_ENV] = new Date(row.t as string).toISOString();
}
