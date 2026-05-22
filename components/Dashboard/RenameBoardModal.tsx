'use client';

import { useState } from 'react';
import { Modal, Input, Textarea, Button } from '@/components/common';
import type { DashboardBoard } from '@/types';

interface Props {
  board: DashboardBoard;
  onClose: () => void;
  onRenamed: (id: string, title: string, description: string | null) => void;
}

export function RenameBoardModal({ board, onClose, onRenamed }: Props) {
  const [title, setTitle] = useState(board.title);
  const [description, setDescription] = useState(board.description ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Title cannot be empty');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const nextDescription = description.trim() || null;
      const res = await fetch(`/api/boards/${board.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed, description: nextDescription }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || 'Failed to rename board');
      }
      onRenamed(board.id, trimmed, nextDescription);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Rename board" size="sm">
      <div className="flex flex-col gap-4">
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          autoFocus
          error={error ?? undefined}
        />
        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional"
          rows={3}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="accent" onClick={save} loading={submitting}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}
