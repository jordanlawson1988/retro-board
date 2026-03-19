'use client';

import { useCallback, useSyncExternalStore } from 'react';

export type Theme = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'retro-theme';
const CYCLE_ORDER: Theme[] = ['system', 'light', 'dark'];

function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // localStorage unavailable
  }
  return 'system';
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

// Module-level state so all hook instances share the same value
let currentTheme: Theme = getStoredTheme();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Theme {
  return currentTheme;
}

function setThemeValue(theme: Theme) {
  currentTheme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // localStorage unavailable
  }
  applyTheme(theme);
  listeners.forEach((l) => l());
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => 'system' as Theme);

  const setTheme = useCallback((t: Theme) => {
    setThemeValue(t);
  }, []);

  const cycleTheme = useCallback(() => {
    const idx = CYCLE_ORDER.indexOf(currentTheme);
    const next = CYCLE_ORDER[(idx + 1) % CYCLE_ORDER.length];
    setThemeValue(next);
  }, []);

  return { theme, setTheme, cycleTheme } as const;
}
