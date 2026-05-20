// Run a single SQL migration file against DATABASE_URL.
// Usage: node --env-file=.env.local scripts/run-one.mjs <path-to-sql>
import { readFileSync } from 'fs';
import { Pool } from '@neondatabase/serverless';

const file = process.argv[2];
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}
if (!file) {
  console.error('usage: node --env-file=.env.local scripts/run-one.mjs <path-to-sql>');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
try {
  const sqlText = readFileSync(file, 'utf-8');
  const client = await pool.connect();
  await client.query(sqlText);
  client.release();
  console.log('Applied', file);
} catch (err) {
  console.error('Migration failed:', err.message);
  process.exit(1);
} finally {
  await pool.end();
}
