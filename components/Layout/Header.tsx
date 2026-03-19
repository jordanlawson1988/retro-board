'use client';

import Link from 'next/link';
import { APP_NAME } from '@/utils/constants';
import { ThemeToggle } from './ThemeToggle';

interface HeaderProps {
  rightContent?: React.ReactNode;
}

export function Header({ rightContent }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-gray-1)] bg-[var(--color-surface-translucent)] backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 hover:no-underline">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="h-9 w-9">
            <path d="M6 2h14Q30 5 30 12v14c0 2.2-1.8 4-4 4H6c-2.2 0-4-1.8-4-4V6c0-2.2 1.8-4 4-4z" fill="#DD0031"/>
            <path d="M20 2v6c0 2.2 1.8 4 4 4h6Q30 5 20 2z" fill="#004F71"/>
          </svg>
          <span className="text-xl font-bold text-[var(--color-gray-8)]">
            {APP_NAME}
          </span>
        </Link>
        <div className="flex items-center gap-3">
          {rightContent}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
