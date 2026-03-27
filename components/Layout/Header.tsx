'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, LayoutDashboard, Settings, Shield, User } from 'lucide-react';
import { APP_NAME } from '@/utils/constants';
import { ThemeToggle } from './ThemeToggle';
import { useAuthStore } from '@/stores/authStore';

interface HeaderProps {
  rightContent?: React.ReactNode;
}

export function Header({ rightContent }: HeaderProps) {
  const { user, adminUser, isAuthenticated, signOut, initialize } = useAuthStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  const handleSignOut = async () => {
    await signOut();
    setDropdownOpen(false);
    router.push('/');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-gray-1)] bg-[var(--color-surface-translucent)] backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href={isAuthenticated ? '/dashboard' : '/'} className="flex items-center gap-2 hover:no-underline">
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
          {isAuthenticated && user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-navy)] text-sm font-medium text-white"
                title={user.name || user.email}
              >
                {(user.name || user.email).charAt(0).toUpperCase()}
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-[var(--color-gray-1)] bg-[var(--color-surface)] py-1 shadow-lg">
                  <div className="border-b border-[var(--color-gray-1)] px-4 py-2">
                    <p className="text-sm font-medium text-[var(--color-gray-8)]">{user.name}</p>
                    <p className="text-xs text-[var(--color-gray-5)]">{user.email}</p>
                  </div>
                  <Link
                    href="/dashboard"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--color-gray-7)] hover:bg-[var(--color-gray-0)]"
                  >
                    <LayoutDashboard size={16} /> My Boards
                  </Link>
                  <Link
                    href="/settings"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--color-gray-7)] hover:bg-[var(--color-gray-0)]"
                  >
                    <Settings size={16} /> Settings
                  </Link>
                  {adminUser && (
                    <Link
                      href="/admin"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--color-gray-7)] hover:bg-[var(--color-gray-0)]"
                    >
                      <Shield size={16} /> Admin
                    </Link>
                  )}
                  <div className="border-t border-[var(--color-gray-1)]">
                    <button
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[var(--color-gray-7)] hover:bg-[var(--color-gray-0)]"
                    >
                      <LogOut size={16} /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-1.5 rounded-md border border-[var(--color-gray-2)] px-3 py-1.5 text-sm font-medium text-[var(--color-gray-7)] hover:bg-[var(--color-gray-0)]"
            >
              <User size={16} /> Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
