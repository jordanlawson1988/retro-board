'use client';

import { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { Modal, Button } from '@/components/common';
import { BOARD_MEMBER_ROLES } from '@/types';
import type { DashboardBoard, BoardMember } from '@/types';

// Owner cannot be reassigned here (transfer-ownership is out of scope).
const ASSIGNABLE_ROLES = BOARD_MEMBER_ROLES.filter((r) => r !== 'owner');

export function ManageMembersModal({
  board,
  onClose,
}: {
  board: DashboardBoard;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/boards/${board.id}/members`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('load failed'))))
      .then((d) => {
        if (active) setMembers((d.members ?? []) as BoardMember[]);
      })
      .catch(() => {
        if (active) setError('Failed to load members');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [board.id]);

  async function changeRole(userId: string, role: string) {
    setMembers((m) =>
      m.map((x) => (x.user_id === userId ? { ...x, role: role as BoardMember['role'] } : x))
    );
    await fetch(`/api/boards/${board.id}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role }),
    });
  }

  async function remove(userId: string) {
    setMembers((m) => m.filter((x) => x.user_id !== userId));
    await fetch(`/api/boards/${board.id}/members`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
  }

  return (
    <Modal open onClose={onClose} title="Manage members" size="md">
      {loading ? (
        <p className="text-sm text-[var(--ink-4)]">Loading…</p>
      ) : error ? (
        <p className="text-sm text-[var(--danger)]">{error}</p>
      ) : members.length === 0 ? (
        <p className="text-sm text-[var(--ink-4)]">No members have joined while signed in yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--line)]">
          {members.map((m) => {
            const isOwnerRole = m.role === 'owner';
            return (
              <li key={m.user_id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-[var(--ink)]">
                    {m.user_name || m.user_email || m.user_id}
                  </p>
                  {m.user_email && (
                    <p className="truncate text-xs text-[var(--ink-4)]">{m.user_email}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {isOwnerRole ? (
                    <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs text-[var(--accent)]">
                      owner
                    </span>
                  ) : (
                    <>
                      <select
                        value={m.role}
                        onChange={(e) => changeRole(m.user_id, e.target.value)}
                        className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--ink)]"
                      >
                        {ASSIGNABLE_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => remove(m.user_id)}
                        className="rounded p-2 text-[var(--ink-4)] hover:text-[var(--danger)]"
                        title="Remove member"
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-4 flex justify-end">
        <Button variant="ghost" onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  );
}
