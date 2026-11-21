/**
 * Validates a caller-supplied post-sign-in destination.
 * Pure: no React, Next or browser imports, so it runs in Vitest's node environment.
 *
 * Returns path + query + hash beginning with a single "/", or null when the
 * value must not be used.
 */
const MAX_LENGTH = 2048;

export function safeRedirectPath(raw: string | null | undefined, origin: string): string | null {
  if (typeof raw !== 'string' || raw === '') return null;
  if (raw.length > MAX_LENGTH) return null;

  // Exactly one leading slash (rejects "//x", "/\x", "x").
  if (raw[0] !== '/' || raw[1] === '/' || raw[1] === '\\') return null;

  // Backslash anywhere: browsers read it as a slash.
  if (raw.includes('\\')) return null;

  // Control characters anywhere, checked on the raw value: the URL parser
  // strips tab, CR and LF, which would turn "/<TAB>/x" into "//x".
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(raw)) return null;

  let parsed: URL;
  try {
    parsed = new URL(raw, origin);
  } catch {
    return null;
  }
  if (parsed.origin !== origin) return null;

  const result = parsed.pathname + parsed.search + parsed.hash;
  if (!result.startsWith('/') || result.startsWith('//')) return null;
  return result;
}
