import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

describe('the create flow leaves the shared feature-flag store alone', () => {
  it('CreateBoardModal and ModeChoice never import or call it', () => {
    for (const file of ['components/Dashboard/CreateBoardModal.tsx', 'components/Phase/ModeChoice.tsx']) {
      const src = read(file);
      expect(src).not.toMatch(/featureFlagStore/);
      expect(src).not.toMatch(/fetchFlags/);
    }
  });
  it('the flags endpoint is read with an abort guard', () => {
    const src = read('components/Dashboard/CreateBoardModal.tsx');
    expect(src).toContain('/api/feature-flags');
    expect(src).toContain('AbortController');
  });
});
