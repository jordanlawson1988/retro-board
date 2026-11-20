import type { BoardSettings } from '@/types';

function same(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Undo one failed settings write on the board as it is now. Each key the write set goes back
 * to its value from `before` (removed if it did not exist), but only while the current value is
 * still the one the write put there; a key something else changed since is left alone. Every
 * other field of the board, and every other settings key, stays as it is now.
 */
export function revertSettingsPatch<B extends { settings: BoardSettings }>(
  current: B,
  before: BoardSettings,
  patch: Partial<BoardSettings>,
): B {
  const settings: Record<string, unknown> = { ...current.settings };
  for (const key of Object.keys(patch) as (keyof BoardSettings)[]) {
    if (!same(settings[key], patch[key])) continue;
    if (Object.prototype.hasOwnProperty.call(before, key)) settings[key] = before[key];
    else delete settings[key];
  }
  return { ...current, settings: settings as unknown as BoardSettings };
}
