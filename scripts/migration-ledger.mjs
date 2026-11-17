// Records applied migration files in the schema_migrations ledger (migration 013).
import { basename } from 'path';

/** "scripts/migrations/013_foo.sql" -> "013"; null when the file has no numeric prefix. */
export function migrationVersion(file) {
  const m = /^(\d+)_/.exec(basename(file));
  return m ? m[1] : null;
}

/**
 * Insert the file's version into schema_migrations when the table exists
 * (ON CONFLICT DO NOTHING). Returns the version recorded, or null when nothing was written
 * (no numeric prefix, or the ledger table does not exist yet).
 */
export async function recordMigration(client, file) {
  const version = migrationVersion(file);
  if (!version) return null;
  const { rows } = await client.query("SELECT to_regclass('public.schema_migrations') IS NOT NULL AS present");
  if (!rows[0]?.present) return null;
  await client.query('INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING', [version]);
  return version;
}
