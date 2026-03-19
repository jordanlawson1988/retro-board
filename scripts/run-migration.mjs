import { readFileSync } from 'fs';
import { Pool } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const migration = readFileSync(new URL('./migrate.sql', import.meta.url), 'utf-8');

try {
  const client = await pool.connect();
  await client.query(migration);
  client.release();
  console.log('Migration complete!');
} catch (err) {
  console.error('Migration failed:', err.message);
  process.exit(1);
} finally {
  await pool.end();
}
