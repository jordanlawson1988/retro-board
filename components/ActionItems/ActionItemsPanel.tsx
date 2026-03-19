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
      className={cn(
        'fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-[var(--color-gray-1)] bg-[var(--color-surface)] shadow-xl transition-transform duration-300',
        open ? 'translate-x-0' : 'translate-x-full'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-gray-1)] px-4 py-3">
        <h3 className="text-base font-semibold text-[var(--color-gray-8)]">Action Items</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={onExportMarkdown}
            className="rounded-[var(--radius-md)] px-2 py-1 text-xs text-[var(--color-gray-4)] hover:bg-[var(--color-gray-1)] hover:text-[var(--color-gray-6)] transition-colors"
            title="Export board as Markdown"
          >
            MD
          </button>
          <button
            onClick={onExportCsv}
            className="rounded-[var(--radius-md)] px-2 py-1 text-xs text-[var(--color-gray-4)] hover:bg-[var(--color-gray-1)] hover:text-[var(--color-gray-6)] transition-colors"
            title="Export board as CSV"
          >
            CSV
          </button>
          <button
            onClick={onClose}
            className="rounded-[var(--radius-md)] p-1.5 text-[var(--color-gray-4)] hover:bg-[var(--color-gray-1)] hover:text-[var(--color-gray-6)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Add item form */}
      {!readOnly && (
        <div className="border-b border-[var(--color-gray-1)] px-4 py-3">
          <div className="flex gap-2">
            <input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="Add an action item..."
              className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-gray-2)] px-3 py-2 text-base focus:border-[var(--color-navy)] focus:outline-none focus:ring-1 focus:ring-[var(--color-navy)]"
            />
            <button
              onClick={handleAdd}
              disabled={!newDescription.trim()}
              className="flex items-center gap-1 rounded-[var(--radius-md)] bg-[var(--color-navy)] px-3 py-2 text-sm text-white hover:bg-[var(--color-navy-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Items list */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {actionItems.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--color-gray-4)]">
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
                <div className="mt-2 mb-1 text-xs font-medium uppercase tracking-wider text-[var(--color-gray-4)]">
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
