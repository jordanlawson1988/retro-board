import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const START = '/* summary print: start */';
const END = '/* summary print: end */';
const css = readFileSync(join(process.cwd(), 'styles/index.css'), 'utf8');

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

function block(): string {
  const start = css.indexOf(START);
  const end = css.indexOf(END);
  if (start < 0 || end < 0 || end < start) return '';
  return css.slice(start + START.length, end);
}

/** Every rule prelude (the text before a `{`) in the block, split on commas. */
function selectors(text: string): string[] {
  const out: string[] = [];
  const re = /([^{};]+)\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const prelude = m[1].trim();
    if (prelude === '@media print' || prelude === '@page rb-summary') continue;
    for (const part of prelude.split(',')) out.push(part.trim());
  }
  return out;
}

describe('summary print stylesheet contract', () => {
  it('has exactly one start marker and one end marker', () => {
    expect(count(css, START)).toBe(1);
    expect(count(css, END)).toBe(1);
    expect(block().length).toBeGreaterThan(0);
  });

  it('scopes every selector to the summary root', () => {
    const list = selectors(block());
    expect(list.length).toBeGreaterThan(0);
    for (const s of list) {
      expect(
        s.startsWith('[data-summary-root]') || s.startsWith('html:has([data-summary-root])'),
        `unscoped selector: ${s}`,
      ).toBe(true);
    }
  });

  it('has no unnamed @page rule, and rb-summary is used nowhere else', () => {
    expect(block()).not.toMatch(/@page\s*\{/);
    const outside = css.replace(block(), '');
    expect(outside).not.toContain('rb-summary');
  });

  it('uses only the words black and white as colours', () => {
    const b = block();
    expect(b).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(b).not.toMatch(/\b(rgb|rgba|oklch|hsl|hsla|color-mix)\(/);
    // every `color`-like declaration value is black or white (or a token reference to be overridden)
    const decls = [...b.matchAll(/(?:^|[{;\s])(color|background|background-color)\s*:\s*([^;}]+)/g)];
    expect(decls.length).toBeGreaterThan(0);
    for (const d of decls) {
      expect(['black', 'white'], `colour value: ${d[2]}`).toContain(d[2].replace('!important', '').trim());
    }
  });

  it('hides the print-hide elements with an important display none', () => {
    expect(block()).toContain('[data-summary-root] [data-print-hide] { display: none !important; }');
  });
});
