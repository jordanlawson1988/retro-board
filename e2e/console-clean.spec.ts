import { test, expect } from '@playwright/test';
import { createBoard } from './helpers';

const BAD = /Hydration failed|script tag while rendering|hydrat/i;

function collect(page: import('@playwright/test').Page) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test.describe('console is clean', () => {
  test('home page (with stored board history) has no hydration/script errors', async ({ page }) => {
    const errors = collect(page);
    await page.addInitScript(() => {
      localStorage.setItem(
        'retro-board-history',
        JSON.stringify([{ boardId: 'abc', title: 'T', lastVisited: new Date().toISOString(), isCompleted: false }])
      );
    });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Recent retros' })).toBeVisible();
    await page.waitForTimeout(1500);
    expect(errors.filter((e) => BAD.test(e))).toEqual([]);
  });

  test('board page has no hydration/script errors', async ({ page, request }) => {
    const errors = collect(page);
    const { boardId, joinCode } = await createBoard(request, { displayName: 'Console Check' });
    expect(joinCode).toBeTruthy();
    await page.addInitScript(() => {
      localStorage.setItem(
        'retro-board-history',
        JSON.stringify([{ boardId: 'abc', title: 'T', lastVisited: new Date().toISOString(), isCompleted: false }])
      );
    });
    await page.goto(`/board/${boardId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    expect(errors.filter((e) => BAD.test(e))).toEqual([]);
  });
});

test.describe('theme applied before hydration', () => {
  for (const stored of ['light', 'dark', 'system', null] as const) {
    test(`stored=${stored}`, async ({ page }) => {
      await page.addInitScript((v) => {
        if (v) localStorage.setItem('retro-theme', v);
        else localStorage.removeItem('retro-theme');
        // Record data-theme at the first moment any app code could run: DOMContentLoaded
        // fires after parser-blocking scripts, before deferred/async hydration chunks.
        document.addEventListener('DOMContentLoaded', () => {
          (window as unknown as { __themeAtDCL: string | null }).__themeAtDCL =
            document.documentElement.getAttribute('data-theme');
        });
      }, stored);
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      const atDcl = await page.evaluate(() => (window as unknown as { __themeAtDCL: string | null }).__themeAtDCL);
      expect(atDcl).toBe(stored ?? 'system');
    });
  }
});
