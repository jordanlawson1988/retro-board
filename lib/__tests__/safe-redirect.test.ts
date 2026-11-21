import { describe, it, expect } from 'vitest';
import { safeRedirectPath } from '../safe-redirect';

const ORIGIN = 'https://retroboard.example';

// The check the login page used before this fix.
const oldCheck = (url: string | null | undefined) =>
  !!url && url.startsWith('/') && !url.startsWith('//');

const accepted = [
  '/dashboard',
  '/board/abc123XYZ_',
  '/board/abc/summary',
  '/settings?tab=email',
  '/dashboard#top',
  '/a/b/c?x=1&y=2#z',
];

// Values a browser resolves to another site (or that are otherwise unsafe).
const offSite: Array<string | null | undefined> = [
  '//evil.example',
  '///evil.example',
  '/\\evil.example',
  '/\\\\evil.example',
  '\\/evil.example',
  '/\t/evil.example',
  '/\n/evil.example',
  '/\r/evil.example',
];

const otherRejected: Array<string | null | undefined> = [
  null,
  undefined,
  '',
  'dashboard',
  'https://evil.example',
  'http://evil.example/x',
  '/a\tb',
  '/\u0000',
  '/a\u007f',
  'javascript:alert(1)',
  'data:text/html,x',
  ' /dashboard',
];

describe('safeRedirectPath', () => {
  it.each(accepted)('accepts %s unchanged', (v) => {
    expect(safeRedirectPath(v, ORIGIN)).toBe(v);
  });

  it.each([...offSite, ...otherRejected])('rejects %j', (v) => {
    expect(safeRedirectPath(v, ORIGIN)).toBeNull();
  });

  it('rejects a non-string', () => {
    expect(safeRedirectPath(42 as unknown as string, ORIGIN)).toBeNull();
    expect(safeRedirectPath({} as unknown as string, ORIGIN)).toBeNull();
  });

  it('accepts a still-percent-encoded backslash: it is a path on our own origin', () => {
    // URLSearchParams.get decodes once, so the page never sees this text for the
    // attack. A literal "%5C" is just characters in a path on our origin and is
    // harmless. The dangerous decoded form ("/\evil.example") is rejected above.
    expect(safeRedirectPath('/%5Cevil.example', ORIGIN)).toBe('/%5Cevil.example');
  });

  it('keeps a trailing space as a path on our origin that still starts with a single slash', () => {
    const r = safeRedirectPath('/dashboard ', ORIGIN);
    if (r !== null) {
      expect(r.startsWith('/')).toBe(true);
      expect(r.startsWith('//')).toBe(false);
      expect(new URL(r, ORIGIN).origin).toBe(ORIGIN);
    }
  });

  it('accepts 2048 characters and rejects 2049', () => {
    const ok = '/' + 'a'.repeat(2047);
    const tooLong = '/' + 'a'.repeat(2048);
    expect(ok).toHaveLength(2048);
    expect(safeRedirectPath(ok, ORIGIN)).toBe(ok);
    expect(safeRedirectPath(tooLong, ORIGIN)).toBeNull();
  });

  it('accepts /@evil.example as a path on our origin', () => {
    const r = safeRedirectPath('/@evil.example', ORIGIN);
    expect(r).toBe('/@evil.example');
    expect(new URL(r!, ORIGIN).origin).toBe(ORIGIN);
  });

  it.each([...accepted, '/@evil.example', '/%5Cevil.example', '/dashboard '])(
    'result for %s stays on our origin',
    (v) => {
      const r = safeRedirectPath(v, ORIGIN);
      expect(r).not.toBeNull();
      expect(new URL(r!, ORIGIN).origin).toBe(ORIGIN);
    }
  );

  describe('control: the old check would have accepted these', () => {
    const acceptedByOld = ['/\\evil.example', '/\t/evil.example', '/\n/evil.example', '/\r/evil.example'];

    it.each(acceptedByOld)('oldCheck accepts %j, new helper rejects it', (v) => {
      expect(oldCheck(v)).toBe(true);
      expect(safeRedirectPath(v, ORIGIN)).toBeNull();
    });

    it('a browser resolves those values off-site (tab/newline stripped, backslash read as slash)', () => {
      for (const v of acceptedByOld) {
        const normalized = v.replace(/[\t\n\r]/g, '').replace(/\\/g, '/');
        expect(new URL(normalized, ORIGIN).origin).not.toBe(ORIGIN);
      }
    });
  });
});
