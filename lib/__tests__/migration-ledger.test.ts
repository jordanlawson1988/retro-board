import { describe, it, expect, vi } from 'vitest';
import { migrationVersion, recordMigration } from '../../scripts/migration-ledger.mjs';

const fakeClient = (present: boolean) => ({
  query: vi.fn(async (text: string) =>
    text.includes('to_regclass') ? { rows: [{ present }] } : { rows: [] }
  ),
});

describe('migrationVersion', () => {
  it('takes the numeric prefix of the file name', () => {
    expect(migrationVersion('scripts/migrations/013_participant_uniqueness_and_ledger.sql')).toBe('013');
    expect(migrationVersion('/abs/path/002_user_accounts.sql')).toBe('002');
  });
  it('is null without a numeric prefix', () => {
    expect(migrationVersion('scripts/migrate.sql')).toBeNull();
    expect(migrationVersion('scripts/migrations/readme.sql')).toBeNull();
  });
});

describe('recordMigration', () => {
  it('inserts with ON CONFLICT DO NOTHING when the ledger exists', async () => {
    const c = fakeClient(true);
    expect(await recordMigration(c, 'scripts/migrations/014_x.sql')).toBe('014');
    const insert = (c.query.mock.calls as unknown as [string, unknown[]][]).find(([t]) => t.includes('INSERT'))!;
    expect(insert[0]).toContain('ON CONFLICT (version) DO NOTHING');
    expect(insert[1]).toEqual(['014']);
  });
  it('writes nothing when the ledger table does not exist', async () => {
    const c = fakeClient(false);
    expect(await recordMigration(c, 'scripts/migrations/012_x.sql')).toBeNull();
    expect(c.query).toHaveBeenCalledTimes(1);
  });
  it('writes nothing for a file without a prefix', async () => {
    const c = fakeClient(true);
    expect(await recordMigration(c, 'scripts/migrate.sql')).toBeNull();
    expect(c.query).not.toHaveBeenCalled();
  });
});
