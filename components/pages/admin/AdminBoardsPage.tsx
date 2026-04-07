'use client';

import { useEffect, useState, useCallback } from 'react';
import { ExternalLink, Archive, Trash2, Download, Search } from 'lucide-react';
import { Button, Modal } from '@/components/common';
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

    try {
      const params = new URLSearchParams({
        filter,
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (search) params.set('search', search);

      const res = await fetch(`/api/admin/boards?${params}`);
      if (!res.ok) throw new Error('Failed to fetch boards');
      const data = await res.json();

      setCounts(data.counts);
      setTotalCount(data.totalCount);
      setBoards(data.boards as BoardRow[]);
    } catch (err) {
      console.error('Failed to fetch boards:', err);
    } finally {
      setLoading(false);
    }
  }, [filter, search, page]);

  useEffect(() => {
    fetchBoards();
  }, [fetchBoards]);

  const handleArchive = async (boardId: string) => {
    try {
      await fetch('/api/admin/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId, action: 'archive' }),
      });
      fetchBoards();
    } catch (err) {
      console.error('Failed to archive board:', err);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch('/api/admin/boards', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId: deleteTarget.id }),
      });
      setDeleteTarget(null);
      fetchBoards();
    } catch (err) {
      console.error('Failed to delete board:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = async (boardId: string, format: 'markdown' | 'csv') => {
    // Dynamic import to avoid SSR issues with DOM APIs
    const { exportMarkdown, exportCsv } = await import('@/utils/export');

    // Fetch all board data from the single board endpoint
    const res = await fetch(`/api/boards/${boardId}`);
    if (!res.ok) return;

    const { board, columns, cards, votes, actionItems } = await res.json();

    const exportData = {
      boardTitle: board.title,
      boardDescription: board.description,
      columns: columns ?? [],
      cards: cards ?? [],
      votes: votes ?? [],
      actionItems: actionItems ?? [],
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
                ? 'bg-[var(--color-primary)] text-white shadow-sm'
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
              &larr; Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-[var(--radius-md)] border border-[var(--color-gray-2)] px-3 py-1 text-xs disabled:opacity-40"
            >
              Next &rarr;
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
