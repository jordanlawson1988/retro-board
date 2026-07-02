'use client';

import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { cn } from '@/utils/cn';
import { ActionItemRow } from './ActionItemRow';
import type { ActionItem, Participant } from '@/types';

interface ActionItemsPanelProps {
  open: boolean;
  onClose: () => void;
  actionItems: ActionItem[];
  participants: Participant[];
  onAddItem: (description: string, assignee?: string, dueDate?: string) => void;
  onUpdateItem: (itemId: string, updates: Partial<Pick<ActionItem, 'description' | 'assignee' | 'due_date' | 'status'>>) => void;
  onDeleteItem: (itemId: string) => void;
  onExportMarkdown: () => void;
  onExportCsv: () => void;
  readOnly?: boolean;
}

export function ActionItemsPanel({
  open,
  onClose,
  actionItems,
  participants,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onExportMarkdown,
  onExportCsv,
  readOnly,
}: ActionItemsPanelProps) {
  const [newDescription, setNewDescription] = useState('');

  const handleAdd = () => {
    const trimmed = newDescription.trim();
    if (!trimmed) return;
    onAddItem(trimmed);
    setNewDescription('');
  };

  const openItems = actionItems.filter((i) => i.status !== 'done');
  const doneItems = actionItems.filter((i) => i.status === 'done');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Action Items"
      // When closed the panel stays mounted (slid off-screen); `inert` pulls it
      // out of the tab/AT order so its controls aren't reachable behind the board.
      {...(open ? {} : { inert: true })}
      className={cn(
        // Desktop: right-side slide-in panel (≥768px)
        'fixed z-50 flex flex-col bg-[var(--surface)] shadow-[var(--shadow-lg)] transition-transform duration-300',
        'md:inset-y-0 md:right-0 md:w-full md:max-w-md md:border-l md:border-[var(--line)]',
        // Mobile: bottom sheet
        'max-md:inset-x-0 max-md:bottom-0 max-md:max-h-[80dvh] max-md:rounded-t-2xl max-md:border-t max-md:border-[var(--line)]',
        open
          ? 'md:translate-x-0 max-md:translate-y-0'
          : 'md:translate-x-full max-md:translate-y-full'
      )}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
        <h3 className="text-base font-semibold text-[var(--ink)]">Action Items</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={onExportMarkdown}
            className="rounded-[var(--r-md)] px-2 py-1 text-xs text-[var(--ink-3)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink)] transition-colors"
            title="Export board as Markdown"
          >
            MD
          </button>
          <button
            onClick={onExportCsv}
            className="rounded-[var(--r-md)] px-2 py-1 text-xs text-[var(--ink-3)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink)] transition-colors"
            title="Export board as CSV"
          >
            CSV
          </button>
          <button
            onClick={onClose}
            aria-label="Close action items"
            className="grid min-h-11 min-w-11 place-items-center rounded-[var(--r-md)] text-[var(--ink-3)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Add item form */}
      {!readOnly && (
        <div className="border-b border-[var(--line)] px-4 py-3">
          <div className="flex gap-2">
            <input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="Add an action item..."
              className="flex-1 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg-sunken)] px-3 py-2 text-base text-[var(--ink)] placeholder:text-[var(--ink-4)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
            <button
              onClick={handleAdd}
              disabled={!newDescription.trim()}
              aria-label="Add action item"
              className="grid min-h-11 min-w-11 place-items-center rounded-[var(--r-md)] bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Items list */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3">
        {actionItems.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--ink-3)]">
            No action items yet. Add one above or drag a card here.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {openItems.map((item) => (
              <ActionItemRow
                key={item.id}
                item={item}
                participants={participants}
                onUpdate={onUpdateItem}
                onDelete={onDeleteItem}
                readOnly={readOnly}
              />
            ))}
            {doneItems.length > 0 && (
              <>
                <div className="mt-2 mb-1 text-xs font-medium uppercase tracking-wider text-[var(--ink-3)]">
                  Completed ({doneItems.length})
                </div>
                {doneItems.map((item) => (
                  <ActionItemRow
                    key={item.id}
                    item={item}
                    participants={participants}
                    onUpdate={onUpdateItem}
                    onDelete={onDeleteItem}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
