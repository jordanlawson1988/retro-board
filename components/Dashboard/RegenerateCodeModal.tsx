'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Modal, Button } from '@/components/common';
import type { DashboardBoard } from '@/types';

export function RegenerateCodeModal({
  board,
  onClose,
  onRegenerated,
}: {
  board: DashboardBoard;
  onClose: () => void;
  onRegenerated: (id: string, code: string) => void;
}) {
  const [code, setCode] = useState<string | undefined>(board.join_code);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function regenerate() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/boards/${board.id}/regenerate-code`, { method: 'POST' });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || 'Failed to regenerate code');
      }
      const d = await res.json();
      setCode(d.joinCode);
      setDone(true);
      onRegenerated(board.id, d.joinCode);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  function copy() {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Modal open onClose={onClose} title="Regenerate join code" size="sm">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[var(--ink-3)]">
          {done
            ? 'New code generated. The old code no longer works.'
            : 'Generating a new code immediately invalidates the current one — anyone using the old code will need the new one.'}
        </p>
        <div className="flex items-center justify-between rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3">
          <span className="font-mono text-xl tracking-widest text-[var(--ink)]">{code ?? '—'}</span>
          {code && (
            <button
              onClick={copy}
              className="rounded p-2 text-[var(--ink-4)] hover:text-[var(--ink)]"
              title="Copy code"
            >
              {copied ? <Check size={16} className="text-[var(--success)]" /> : <Copy size={16} />}
            </button>
          )}
        </div>
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {done ? 'Done' : 'Cancel'}
          </Button>
          {!done && (
            <Button variant="accent" onClick={regenerate} loading={submitting}>
              Regenerate
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
