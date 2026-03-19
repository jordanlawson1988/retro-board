'use client';

import type { ReactNode } from 'react';
import { Header } from './Header';

interface AppShellProps {
  children: ReactNode;
  headerRight?: ReactNode;
}

export function AppShell({ children, headerRight }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-warm-white)]">
      <Header rightContent={headerRight} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
