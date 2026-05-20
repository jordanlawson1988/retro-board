'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search } from 'lucide-react';
import { AppShell } from '@/components/Layout';
import { Button, Chip } from '@/components/common';
import { BoardCard } from '@/components/Dashboard';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/utils/cn';

type Filter = 'all' | 'active' | 'completed';

interface DashboardBoard {
  id: string;
  title: string;
  description: string | null;
  template: string;
  created_at: string;
  archived_at: string | null;
  card_count: number;
  participant_count: number;
  action_count: number;
  user_role: string;
}

interface UserStats {
  activeBoards: number;
  cardsCreated: number;
  votesCast: number;
  actionItemsCreated: number | null;
}

export function DashboardPage() {
  const [boards, setBoards] = useState<DashboardBoard[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuthStore();

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push('/login?redirect=/dashboard');
      return;
    }

    async function fetchBoards() {
      setLoading(true);
      const res = await fetch(`/api/user/boards?filter=${filter}`);
      if (res.ok) {
        const data = await res.json();
        setBoards(data.boards);
      }
      setLoading(false);
    }
    fetchBoards();
  }, [filter, isAuthenticated, authLoading, router]);

  // Per-user stats are account-wide — fetched once, independent of the filter.
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    fetch('/api/user/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setStats(data as UserStats); })
      .catch(() => {});
  }, [isAuthenticated, authLoading]);

  const filteredBoards = search
    ? boards.filter((b) => b.title.toLowerCase().includes(search.toLowerCase()))
    : boards;

  const ownedBoards = filteredBoards.filter((b) => b.user_role === 'owner');
  const sharedBoards = filteredBoards.filter((b) => b.user_role !== 'owner');

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-8">
          {/* Welcome + heading */}
          <section>
            <p className="text-[13px] text-[var(--ink-4)] mb-1.5">
              Welcome back, {user?.name?.split(' ')[0] ?? 'there'}
            </p>
            <div className="flex items-center justify-between">
              <h1>Your boards</h1>
              <Button onClick={() => router.push('/')}>
                <Plus size={18} /> New Retro
              </Button>
            </div>
          </section>

          {/* 4-up stat strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Active boards', value: stats?.activeBoards ?? '—', accent: true },
              { label: 'Action items',  value: stats?.actionItemsCreated ?? '—' },
              { label: 'Cards created', value: stats?.cardsCreated ?? '—' },
              { label: 'Votes cast',    value: stats?.votesCast ?? '—' },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-[var(--surface)] border border-[var(--line)] rounded-[var(--r-xl)] p-4"
              >
                <p className="text-[11px] text-[var(--ink-4)] uppercase tracking-wide mb-2">
                  {s.label}
                </p>
                <p
                  className={cn(
                    'font-mono tabular-nums text-[28px] font-semibold',
                    s.accent ? 'text-[var(--accent)]' : 'text-[var(--ink)]'
                  )}
                >
                  {s.value}
                </p>
              </div>
            ))}
          </div>

          {/* Filters + Search */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2">
              {(['all', 'active', 'completed'] as Filter[]).map((f) => (
                <Chip
                  key={f}
                  active={filter === f}
                  onClick={() => setFilter(f)}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Chip>
              ))}
            </div>
            <div className="relative w-full sm:w-64">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-4)]"
              />
              <input
                type="text"
                placeholder="Search boards..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={cn(
                  'w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] py-2 pl-9 pr-3 text-sm',
                  'text-[var(--ink)] placeholder:text-[var(--ink-4)] outline-none',
                  'focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-soft)]',
                  'transition-[border-color,box-shadow] duration-150'
                )}
              />
            </div>
          </div>

          {/* Board Grid */}
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-40 animate-pulse rounded-[var(--r-xl)] border border-[var(--line)] bg-[var(--surface-muted)]"
                />
              ))}
            </div>
          ) : (
            <>
              {ownedBoards.length > 0 && (
                <section>
                  <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-[var(--ink-4)]">
                    My Retros ({ownedBoards.length})
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {ownedBoards.map((board) => (
                      <BoardCard key={board.id} board={board} />
                    ))}
                  </div>
                </section>
              )}

              {sharedBoards.length > 0 && (
                <section>
                  <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-[var(--ink-4)]">
                    Shared With Me ({sharedBoards.length})
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {sharedBoards.map((board) => (
                      <BoardCard key={board.id} board={board} />
                    ))}
                  </div>
                </section>
              )}

              {ownedBoards.length === 0 && sharedBoards.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-lg text-[var(--ink-3)]">No boards yet</p>
                  <p className="mt-1 text-sm text-[var(--ink-4)]">
                    Create your first retro to get started.
                  </p>
                  <Button className="mt-4" onClick={() => router.push('/')}>
                    <Plus size={18} /> Create a Retro
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
