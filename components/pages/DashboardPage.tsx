'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search } from 'lucide-react';
import { AppShell } from '@/components/Layout';
import { Button } from '@/components/common';
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

export function DashboardPage() {
  const [boards, setBoards] = useState<DashboardBoard[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuthStore();

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

  const filteredBoards = search
    ? boards.filter((b) => b.title.toLowerCase().includes(search.toLowerCase()))
    : boards;

  const ownedBoards = filteredBoards.filter((b) => b.user_role === 'owner');
  const sharedBoards = filteredBoards.filter((b) => b.user_role !== 'owner');

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-[var(--color-gray-8)]">My Boards</h1>
            <Button onClick={() => router.push('/')}>
              <Plus size={18} /> New Retro
            </Button>
          </div>

          {/* Filters + Search */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-1 rounded-lg border border-[var(--color-gray-1)] bg-[var(--color-surface)] p-1">
              {(['all', 'active', 'completed'] as Filter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    filter === f
                      ? 'bg-[var(--color-navy)] text-white'
                      : 'text-[var(--color-gray-5)] hover:text-[var(--color-gray-7)]'
                  )}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-64">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-gray-4)]" />
              <input
                type="text"
                placeholder="Search boards..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-gray-1)] bg-[var(--color-surface)] py-2 pl-9 pr-3 text-sm"
              />
            </div>
          </div>

          {/* Board Grid */}
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-40 animate-pulse rounded-xl border border-[var(--color-gray-1)] bg-[var(--color-gray-0)]" />
              ))}
            </div>
          ) : (
            <>
              {ownedBoards.length > 0 && (
                <section>
                  <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-[var(--color-gray-4)]">
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
                  <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-[var(--color-gray-4)]">
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
                  <p className="text-lg text-[var(--color-gray-5)]">No boards yet</p>
                  <p className="mt-1 text-sm text-[var(--color-gray-4)]">Create your first retro to get started.</p>
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
