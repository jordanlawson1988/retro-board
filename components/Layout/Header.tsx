'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, LayoutDashboard, Settings, Shield, User } from 'lucide-react';
import { APP_NAME } from '@/utils/constants';
import { ThemeToggle } from './ThemeToggle';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/common';
import { avatarBackground } from '@/utils/avatarHue';

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
    <header
      className="sticky top-0 z-40 h-[60px] border-b border-[var(--line)] backdrop-blur-[8px]"
      style={{ background: 'color-mix(in oklab, var(--bg) 90%, transparent)' }}
    >
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="rb-logo flex items-center gap-2.5 hover:no-underline">
          <span className="rb-logo-mark" aria-hidden>R</span>
          <span className="text-[16px] font-semibold tracking-tight text-[var(--ink)]">
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
                className="flex w-8 h-8 items-center justify-center rounded-full text-[13px] font-medium text-[var(--bg-elev)]"
                style={{ background: avatarBackground(user.id) }}
                title={user.name || user.email}
              >
                {(user.name || user.email).charAt(0).toUpperCase()}
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] py-1 shadow-[var(--shadow-md)]">
                  <div className="border-b border-[var(--line)] px-4 py-2">
                    <p className="text-sm font-medium text-[var(--ink)]">{user.name}</p>
                    <p className="text-xs text-[var(--ink-4)]">{user.email}</p>
                  </div>
                  <Link
                    href="/dashboard"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--ink-2)] hover:bg-[var(--surface-muted)]"
                  >
                    <LayoutDashboard size={16} /> My Boards
                  </Link>
                  <Link
                    href="/settings"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--ink-2)] hover:bg-[var(--surface-muted)]"
                  >
                    <Settings size={16} /> Settings
                  </Link>
                  {adminUser && (
                    <Link
                      href="/admin"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--ink-2)] hover:bg-[var(--surface-muted)]"
                    >
                      <Shield size={16} /> Admin
                    </Link>
                  )}
                  <div className="border-t border-[var(--line)]">
                    <button
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[var(--ink-2)] hover:bg-[var(--surface-muted)]"
                    >
                      <LogOut size={16} /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link href="/login">
              <Button variant="default" size="sm">
                <User size={14} /> Sign In
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
