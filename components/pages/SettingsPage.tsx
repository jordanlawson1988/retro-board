'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { AppShell } from '@/components/Layout';

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
          {/* Sections added in Tasks 5–10 */}
        </div>
      </div>
    </AppShell>
  );
}
