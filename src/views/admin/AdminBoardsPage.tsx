import { useEffect, useState, useCallback } from 'react';
import { ExternalLink, Archive, Trash2, Download, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button, Modal } from '@/components/common';
import { exportMarkdown, exportCsv } from '@/utils/export';
import type { Board } from '@/types';

type BoardFilter = 'all' | 'active' | 'completed';

interface BoardRow extends Board {
  participant_count: number;
  card_count: number;
}

const PAGE_SIZE = 10;

export function AdminBoardsPage() {
  const [boards, setBoards] = useState<BoardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<BoardFilter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [counts, setCounts] = useState({ all: 0, active: 0, completed: 0 });
  const [deleteTarget, setDeleteTarget] = useState<BoardRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchBoards = useCallback(async () => {
    setLoading(true);

    // Get counts for filter tabs
    const [allRes, activeRes, completedRes] = await Promise.all([
      supabase.from('boards').select('id', { count: 'exact', head: true }),
      supabase.from('boards').select('id', { count: 'exact', head: true }).is('archived_at', null),
      supabase.from('boards').select('id', { count: 'exact', head: true }).not('archived_at', 'is', null),
    ]);
    setCounts({
      all: allRes.count ?? 0,
      active: activeRes.count ?? 0,
      completed: completedRes.count ?? 0,
    });

    // Build main query
    let query = supabase
      .from('boards')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (filter === 'active') query = query.is('archived_at', null);
    if (filter === 'completed') query = query.not('archived_at', 'is', null);
    if (search) query = query.ilike('title', `%${search}%`);

    const { data, count } = await query;
    setTotalCount(count ?? 0);

    if (data) {
      const boardIds = data.map((b) => b.id);

      const [participantsRes, cardsRes] = await Promise.all([
        supabase.from('participants').select('board_id').in('board_id', boardIds),
        supabase.from('cards').select('board_id').in('board_id', boardIds),
      ]);

      const pCounts = new Map<string, number>();
      participantsRes.data?.forEach((p) => pCounts.set(p.board_id, (pCounts.get(p.board_id) ?? 0) + 1));

      const cCounts = new Map<string, number>();
      cardsRes.data?.forEach((c) => cCounts.set(c.board_id, (cCounts.get(c.board_id) ?? 0) + 1));

      setBoards(
        data.map((b) => ({
          ...(b as Board),
          participant_count: pCounts.get(b.id) ?? 0,
          card_count: cCounts.get(b.id) ?? 0,
        }))
      );
    }

    setLoading(false);
  }, [filter, search, page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBoards();
  }, [fetchBoards]);

  const handleArchive = async (boardId: string) => {
    // Fetch current settings first to avoid overwriting the entire JSONB column
    const { data: board } = await supabase
      .from('boards')
      .select('settings')
      .eq('id', boardId)
      .single();

    const mergedSettings = { ...(board?.settings ?? {}), board_locked: true };

    await supabase
      .from('boards')
      .update({ archived_at: new Date().toISOString(), settings: mergedSettings })
      .eq('id', boardId);
    fetchBoards();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await supabase.from('boards').delete().eq('id', deleteTarget.id);
    setDeleteTarget(null);
    setDeleting(false);
    fetchBoards();
  };

  const handleExport = async (boardId: string, format: 'markdown' | 'csv') => {
    const [boardRes, colsRes, cardsRes, votesRes, actionsRes] = await Promise.all([
      supabase.from('boards').select('*').eq('id', boardId).single(),
      supabase.from('columns').select('*').eq('board_id', boardId).order('position'),
      supabase.from('cards').select('*').eq('board_id', boardId).order('position'),
      supabase.from('votes').select('*').eq('board_id', boardId),
      supabase.from('action_items').select('*').eq('board_id', boardId).order('created_at'),
    ]);

    if (!boardRes.data) return;

    const exportData = {
      boardTitle: boardRes.data.title,
      boardDescription: boardRes.data.description,
      columns: colsRes.data ?? [],
      cards: cardsRes.data ?? [],
      votes: votesRes.data ?? [],
      actionItems: actionsRes.data ?? [],
    };

    if (format === 'markdown') exportMarkdown(exportData);
    else exportCsv(exportData);
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const filterTabs: { key: BoardFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'active', label: 'Active', count: counts.active },
    { key: 'completed', label: 'Completed', count: counts.completed },
  ];

  return (
    <div>
      <h1 className="text-xl font-bold text-[var(--color-gray-8)]">Boards</h1>
      <p className="mt-1 text-sm text-[var(--color-gray-5)]">View and manage all retrospective boards</p>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setFilter(tab.key); setPage(0); }}
            className={`rounded-[var(--radius-md)] px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === tab.key
                ? 'bg-[var(--color-gray-8)] text-white'
                : 'bg-[var(--color-surface)] border border-[var(--color-gray-2)] text-[var(--color-gray-6)] hover:border-[var(--color-gray-3)]'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
        <div className="flex-1" />
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-gray-4)]" />
          <input
            type="text"
            placeholder="Search boards..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="rounded-[var(--radius-md)] border border-[var(--color-gray-2)] bg-[var(--color-surface)] py-1.5 pl-8 pr-3 text-sm text-[var(--color-gray-8)] placeholder:text-[var(--color-gray-4)] focus:border-[var(--color-primary)] focus:outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-gray-1)] bg-[var(--color-surface)]">
        {/* Header */}
        <div className="grid grid-cols-[2fr_1fr_80px_80px_100px_120px] gap-2 border-b border-[var(--color-gray-1)] bg-[var(--color-surface-subtle)] px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-gray-5)]">
          <div>Board</div>
          <div>Template</div>
          <div>Users</div>
          <div>Cards</div>
          <div>Created</div>
          <div></div>
        </div>

        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-[var(--color-gray-5)]">Loading...</div>
        ) : boards.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-[var(--color-gray-4)]">No boards found</div>
        ) : (
          boards.map((board) => (
            <div key={board.id} className="grid grid-cols-[2fr_1fr_80px_80px_100px_120px] items-center gap-2 border-b border-[var(--color-gray-1)] px-4 py-3 text-sm last:border-b-0">
              <div>
                <p className="font-medium text-[var(--color-gray-8)]">{board.title}</p>
                <p className="text-xs text-[var(--color-gray-4)]">ID: {board.id}</p>
              </div>
              <div className="text-[var(--color-gray-5)] text-xs">{board.template}</div>
              <div className="text-[var(--color-gray-5)]">{board.participant_count}</div>
              <div className="text-[var(--color-gray-5)]">{board.card_count}</div>
              <div className="text-xs text-[var(--color-gray-5)]">
                {new Date(board.created_at).toLocaleDateString()}
              </div>
              <div className="flex items-center gap-1">
                <a
                  href={`/board/${board.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded p-1 text-[var(--color-gray-4)] hover:bg-[var(--color-gray-1)] hover:text-[var(--color-gray-6)]"
                  title="View board"
                >
                  <ExternalLink size={14} />
                </a>
                {!board.archived_at && (
                  <button
                    onClick={() => handleArchive(board.id)}
                    className="rounded p-1 text-[var(--color-gray-4)] hover:bg-[var(--color-gray-1)] hover:text-[var(--color-gray-6)]"
                    title="Archive board"
                  >
                    <Archive size={14} />
                  </button>
                )}
                <button
                  onClick={() => handleExport(board.id, 'markdown')}
                  className="rounded p-1 text-[var(--color-gray-4)] hover:bg-[var(--color-gray-1)] hover:text-[var(--color-gray-6)]"
                  title="Export markdown"
                >
                  <Download size={14} />
                </button>
                <button
                  onClick={() => setDeleteTarget(board)}
                  className="rounded p-1 text-[var(--color-gray-4)] hover:bg-[var(--color-error)]/10 hover:text-[var(--color-error)]"
                  title="Delete board"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm text-[var(--color-gray-5)]">
          <span>Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}</span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-[var(--radius-md)] border border-[var(--color-gray-2)] px-3 py-1 text-xs disabled:opacity-40"
            >
              ← Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-[var(--radius-md)] border border-[var(--color-gray-2)] px-3 py-1 text-xs disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Board"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[var(--color-gray-5)]">
            Permanently delete <strong className="text-[var(--color-gray-8)]">{deleteTarget?.title}</strong> and all its data? This cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button onClick={handleDelete} loading={deleting}>Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
