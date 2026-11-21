import { describe, it, expect } from 'vitest';
import { flagEnabled } from '@/lib/feature-flags';

describe('flagEnabled', () => {
  it('is true only for an enabled flag with that key', () => {
    expect(flagEnabled({ flags: [{ key: 'summary_email', is_enabled: true }] }, 'summary_email')).toBe(true);
    expect(flagEnabled({ flags: [{ key: 'summary_email', is_enabled: false }] }, 'summary_email')).toBe(false);
  });
  it('a missing flag is off', () => {
    expect(flagEnabled({ flags: [{ key: 'guided_mode', is_enabled: true }] }, 'summary_email')).toBe(false);
  });
  it('a failed or malformed response is off', () => {
    expect(flagEnabled(null, 'summary_email')).toBe(false);
    expect(flagEnabled({}, 'summary_email')).toBe(false);
    expect(flagEnabled({ flags: 'x' }, 'summary_email')).toBe(false);
    expect(flagEnabled({ flags: [null, 3] }, 'summary_email')).toBe(false);
    expect(flagEnabled({ flags: [{ key: 'summary_email', is_enabled: 'true' }] }, 'summary_email')).toBe(false);
  });
});
