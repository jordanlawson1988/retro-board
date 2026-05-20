'use client';

import { Monitor, Sun, Moon } from 'lucide-react';
import { useTheme, type Theme } from '@/hooks/useTheme';
import { IconButton } from '@/components/common';

const THEME_META: Record<Theme, { icon: typeof Monitor; label: string }> = {
  system: { icon: Monitor, label: 'System theme' },
  light: { icon: Sun, label: 'Light theme' },
  dark: { icon: Moon, label: 'Dark theme' },
};

export function ThemeToggle() {
  const { theme, cycleTheme } = useTheme();
  const { icon: Icon, label } = THEME_META[theme];

  return (
    <IconButton onClick={cycleTheme} aria-label={label} title={label}>
      <Icon size={16} />
    </IconButton>
  );
}
