'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { AppShell } from '@/components/Layout';
import { useTheme, type Theme } from '@/hooks/useTheme';
import { Sun, Moon, Monitor } from 'lucide-react';
import { cn } from '@/utils/cn';

function Section({ title, description, children }: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-[var(--surface)] border border-[var(--line)] rounded-[var(--r-xl)] p-6">
      <h2 className="text-[var(--t-h3)] font-semibold mb-1">{title}</h2>
      {description && <p className="text-[13px] text-[var(--ink-4)] mb-4">{description}</p>}
      <div className={description ? '' : 'mt-2'}>{children}</div>
    </section>
  );
}

const THEME_OPTIONS: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  return (
    <Section title="Appearance" description="Choose how RetroBoard looks on this device.">
      <div className="inline-flex p-[3px] gap-0.5 rounded-[10px] bg-[var(--surface-muted)] border border-[var(--line)]">
        {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
          const active = theme === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              aria-pressed={active}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] text-[13px] font-medium transition-[background-color,color,box-shadow] duration-150',
                active
                  ? 'bg-[var(--bg-elev)] text-[var(--ink)] shadow-[var(--shadow-xs)]'
                  : 'bg-transparent text-[var(--ink-3)] hover:text-[var(--ink)]'
              )}
            >
              <Icon size={14} /> {label}
            </button>
          );
        })}
      </div>
    </Section>
  );
}

export function SettingsPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuthStore();

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) router.push('/login?redirect=/settings');
  }, [authLoading, isAuthenticated, router]);

  if (authLoading || !isAuthenticated || !user) {
    return (
      <AppShell>
        <div className="min-h-[40vh] grid place-items-center text-[13px] text-[var(--ink-4)]">
          Loading…
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1>Settings</h1>
          <p className="text-[13px] text-[var(--ink-4)] mt-1">Manage your account and preferences.</p>
        </div>
        <div className="flex flex-col gap-4">
          <AppearanceSection />
        </div>
      </div>
    </AppShell>
  );
}
