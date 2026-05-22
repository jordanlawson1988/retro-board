import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Pool } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

// Optional file arg (relative to repo root); defaults to the combined base schema.
const fileArg = process.argv[2];
const migrationPath = fileArg
  ? resolve(process.cwd(), fileArg)
  : new URL('./migrate.sql', import.meta.url);
const migration = readFileSync(migrationPath, 'utf-8');
console.log(`Applying: ${fileArg ?? 'scripts/migrate.sql'}`);

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
