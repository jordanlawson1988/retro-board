'use client';

import { Monitor, Sun, Moon } from 'lucide-react';
import { useTheme, type Theme } from '@/hooks/useTheme';

const THEME_META: Record<Theme, { icon: typeof Monitor; label: string }> = {
  system: { icon: Monitor, label: 'System theme' },
  light: { icon: Sun, label: 'Light theme' },
  dark: { icon: Moon, label: 'Dark theme' },
};

export function ThemeToggle() {
  const { theme, cycleTheme } = useTheme();
  const { icon: Icon, label } = THEME_META[theme];

  return (
    <button
      type="button"
      onClick={cycleTheme}
      aria-label={label}
      title={label}
      className="rounded-[var(--radius-md)] p-2 text-[var(--color-gray-5)] transition-colors hover:bg-[var(--color-gray-1)] hover:text-[var(--color-gray-7)]"
    >
      <Icon size={18} />
    </button>
  );
}
