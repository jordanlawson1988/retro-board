import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Kanban, Flag, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface DashboardStats {
  activeBoards: number;
  completedBoards: number;
  totalFlags: number;
}

interface RecentBoard {
  id: string;
  title: string;
  created_at: string;
  archived_at: string | null;
  participantCount: number;
}

export function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({ activeBoards: 0, completedBoards: 0, totalFlags: 0 });
  const [recentBoards, setRecentBoards] = useState<RecentBoard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      const [activeRes, completedRes, flagsRes, boardsRes] = await Promise.all([
        supabase.from('boards').select('id', { count: 'exact', head: true }).is('archived_at', null),
        supabase.from('boards').select('id', { count: 'exact', head: true }).not('archived_at', 'is', null),
        supabase.from('feature_flags').select('id', { count: 'exact', head: true }),
        supabase.from('boards').select('id, title, created_at, archived_at').order('created_at', { ascending: false }).limit(5),
      ]);

      setStats({
        activeBoards: activeRes.count ?? 0,
        completedBoards: completedRes.count ?? 0,
        totalFlags: flagsRes.count ?? 0,
      });

      if (boardsRes.data) {
        // Fetch participant counts for recent boards
        const boardIds = boardsRes.data.map((b) => b.id);
        const { data: participants } = await supabase
          .from('participants')
          .select('board_id')
          .in('board_id', boardIds);

        const countMap = new Map<string, number>();
        participants?.forEach((p) => {
          countMap.set(p.board_id, (countMap.get(p.board_id) ?? 0) + 1);
        });

        setRecentBoards(
          boardsRes.data.map((b) => ({
            ...b,
            participantCount: countMap.get(b.id) ?? 0,
          }))
        );
      }

      setLoading(false);
    }

    loadDashboard();
  }, []);

  if (loading) {
    return <div className="text-sm text-[var(--color-gray-5)]">Loading dashboard...</div>;
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-[var(--color-gray-8)]">Dashboard</h1>
      <p className="mt-1 text-sm text-[var(--color-gray-5)]">Overview of your RetroBoard instance</p>

      {/* Stat cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard icon={Kanban} label="Active Boards" value={stats.activeBoards} />
        <StatCard icon={CheckCircle2} label="Completed" value={stats.completedBoards} />
        <StatCard icon={Flag} label="Feature Flags" value={stats.totalFlags} />
      </div>

      {/* Recent boards */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--color-gray-7)]">Recent Boards</h2>
          <Link to="/admin/boards" className="text-xs text-[var(--color-primary)] hover:underline">
            View all →
          </Link>
        </div>
        <div className="mt-3 rounded-[var(--radius-lg)] border border-[var(--color-gray-1)] bg-[var(--color-surface)] overflow-hidden">
          {recentBoards.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[var(--color-gray-4)]">No boards yet</div>
          ) : (
            recentBoards.map((board) => (
              <div key={board.id} className="flex items-center justify-between border-b border-[var(--color-gray-1)] px-4 py-3 last:border-b-0">
                <div>
                  <p className="text-sm font-medium text-[var(--color-gray-8)]">{board.title}</p>
                  <p className="text-xs text-[var(--color-gray-4)]">
                    {board.participantCount} participant{board.participantCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  board.archived_at
                    ? 'bg-[var(--color-info)]/10 text-[var(--color-info)]'
                    : 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
                }`}>
                  {board.archived_at ? 'Completed' : 'Active'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-gray-1)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center gap-2 text-[var(--color-gray-4)]">
        <Icon size={16} />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-[var(--color-gray-8)]">{value}</p>
    </div>
  );
}
