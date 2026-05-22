import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Contract: every endpoint that lists/looks-up boards MUST exclude soft-deleted
// rows. If you add a new board-list consumer, add it here AND add the guard.
// Mirrors the "vocabulary contract test" pattern — catches divergence before merge.
const root = process.cwd();
const MUST_EXCLUDE_DELETED = [
  'app/api/user/boards/route.ts',
  'app/api/user/stats/route.ts',
  'app/api/boards/join/route.ts',
  'app/api/admin/boards/route.ts',
];

describe('soft-delete exclusion contract', () => {
  for (const f of MUST_EXCLUDE_DELETED) {
    it(`${f} guards against deleted_at`, () => {
      const src = readFileSync(join(root, f), 'utf8');
      expect(src).toMatch(/deleted_at IS NULL/);
    });
  }

  it('user/boards exposes a Trash branch (deleted_at IS NOT NULL)', () => {
    const src = readFileSync(join(root, 'app/api/user/boards/route.ts'), 'utf8');
    expect(src).toMatch(/deleted_at IS NOT NULL/);
  });

  it('user/boards lazy-purges boards older than 30 days', () => {
    const src = readFileSync(join(root, 'app/api/user/boards/route.ts'), 'utf8');
    expect(src).toMatch(/interval '30 days'/);
  });
});
