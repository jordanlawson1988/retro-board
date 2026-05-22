'use client';

import { useState } from 'react';
import { Modal, Input, Button } from '@/components/common';
import type { DashboardBoard } from '@/types';

interface Props {
  board: DashboardBoard;
  mode: 'trash' | 'forever';
  onClose: () => void;
  onTrashed: (id: string) => void;
  onPurged: (id: string) => void;
}

export function DeleteBoardDialog({ board, mode, onClose, onTrashed, onPurged }: Props) {
  const [confirmText, setConfirmText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const forever = mode === 'forever';
  const canConfirm = !forever || confirmText.trim() === board.title.trim();

  async function confirm() {
    if (!canConfirm) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = forever
        ? await fetch(`/api/boards/${board.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'purge' }),
          })
        : await fetch(`/api/boards/${board.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || 'Failed');
      }
      if (forever) onPurged(board.id);
      else onTrashed(board.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={forever ? 'Delete forever' : 'Move to Trash'} size="sm">
      <div className="flex flex-col gap-4">
        {forever ? (
          <>
            <p className="text-sm text-[var(--ink-3)]">
              This permanently deletes <strong className="text-[var(--ink)]">{board.title}</strong>{' '}
              and all its cards, votes, and action items. This cannot be undone.
            </p>
            <Input
              label={`Type "${board.title}" to confirm`}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoFocus
            />
          </>
        ) : (
          <p className="text-sm text-[var(--ink-3)]">
            <strong className="text-[var(--ink)]">{board.title}</strong> will move to Trash. You can
            restore it within 30 days, after which it&apos;s permanently deleted.
          </p>
        )}
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirm} loading={submitting} disabled={!canConfirm}>
            {forever ? 'Delete forever' : 'Move to Trash'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
