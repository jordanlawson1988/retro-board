'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { AppShell } from '@/components/Layout';
import { useTheme, type Theme } from '@/hooks/useTheme';
import { Sun, Moon, Monitor, Lock } from 'lucide-react';
import { cn } from '@/utils/cn';
import { authClient } from '@/lib/auth-client';
import { avatarBackground } from '@/utils/avatarHue';
import type { User } from '@/types';

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

function ProfileSection({ user }: { user: User }) {
  const refreshUser = useAuthStore((s) => s.initialize);
  const [name, setName] = useState(user.name ?? '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const dirty = name.trim() !== (user.name ?? '').trim();
  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
    : '—';

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setMsg({ kind: 'err', text: 'Name cannot be empty.' }); return; }
    setSaving(true);
    setMsg(null);
    const { error } = await authClient.updateUser({ name: trimmed });
    setSaving(false);
    if (error) { setMsg({ kind: 'err', text: error.message ?? 'Could not update name.' }); return; }
    await refreshUser();
    setMsg({ kind: 'ok', text: 'Saved.' });
  };

  return (
    <Section title="Profile">
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-10 h-10 rounded-full grid place-items-center text-[15px] font-medium text-[var(--bg-elev)]"
          style={{ background: avatarBackground(user.id) }}
        >
          {(user.name || user.email).charAt(0).toUpperCase()}
        </div>
        <div className="text-[12px] text-[var(--ink-4)]">Member since {memberSince}</div>
      </div>

      <label className="block text-[13px] text-[var(--ink-2)] mb-1.5" htmlFor="settings-name">Name</label>
      <div className="flex gap-2 mb-1">
        <input
          id="settings-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          className="flex-1 px-3 py-2.5 rounded-[var(--r-md)] text-[15px] bg-[var(--surface)] border border-[var(--line)] text-[var(--ink)] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-soft)] transition-[border-color,box-shadow] duration-150"
        />
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          className="px-3.5 py-2.5 rounded-[var(--r-md)] text-[13px] font-medium bg-[var(--ink)] text-[var(--bg-elev)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      {msg && (
        <p className={cn('text-[12px] mb-4', msg.kind === 'ok' ? 'text-[var(--success)]' : 'text-[var(--danger)]')}>
          {msg.text}
        </p>
      )}

      <label className="block text-[13px] text-[var(--ink-2)] mt-4 mb-1.5">Email (username)</label>
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-[var(--r-md)] bg-[var(--surface-muted)] border border-[var(--line)] text-[15px] text-[var(--ink-3)]">
        <Lock size={14} className="text-[var(--ink-4)]" />
        <span>{user.email}</span>
      </div>
      <p className="text-[12px] text-[var(--ink-4)] mt-1.5">Your email is your username and can&apos;t be changed.</p>
    </Section>
  );
}

function ChangePasswordBlock() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const inputCls =
    'w-full px-3 py-2.5 rounded-[var(--r-md)] text-[15px] bg-[var(--surface)] border border-[var(--line)] text-[var(--ink)] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-soft)] transition-[border-color,box-shadow] duration-150';

  const submit = async () => {
    if (next.length < 8) { setMsg({ kind: 'err', text: 'New password must be at least 8 characters.' }); return; }
    if (next !== confirm) { setMsg({ kind: 'err', text: 'New passwords do not match.' }); return; }
    setBusy(true);
    setMsg(null);
    const { error } = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: false,
    });
    setBusy(false);
    if (error) { setMsg({ kind: 'err', text: error.message ?? 'Could not change password.' }); return; }
    setCurrent(''); setNext(''); setConfirm('');
    setMsg({ kind: 'ok', text: 'Password changed.' });
  };

  return (
    <div>
      <h3 className="text-[14px] font-semibold mb-3">Change password</h3>
      <div className="flex flex-col gap-2.5 max-w-sm">
        <input type="password" placeholder="Current password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={inputCls} />
        <input type="password" placeholder="New password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={inputCls} />
        <input type="password" placeholder="Confirm new password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} />
        <button
          type="button"
          onClick={submit}
          disabled={busy || !current || !next || !confirm}
          className="self-start px-3.5 py-2.5 rounded-[var(--r-md)] text-[13px] font-medium bg-[var(--ink)] text-[var(--bg-elev)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? 'Updating…' : 'Update password'}
        </button>
        {msg && (
          <p className={cn('text-[12px]', msg.kind === 'ok' ? 'text-[var(--success)]' : 'text-[var(--danger)]')}>{msg.text}</p>
        )}
      </div>
    </div>
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
          <ProfileSection user={user} />
        </div>
      </div>
    </AppShell>
  );
}
