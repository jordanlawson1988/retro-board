'use client';

import { useState } from 'react';
import { Check, Circle, Clock, Trash2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { ActionItem, ActionItemStatus, Participant } from '@/types';

interface ActionItemRowProps {
  item: ActionItem;
  participants: Participant[];
  onUpdate: (itemId: string, updates: Partial<Pick<ActionItem, 'description' | 'assignee' | 'due_date' | 'status'>>) => void;
  onDelete: (itemId: string) => void;
  readOnly?: boolean;
}

const STATUS_CYCLE: ActionItemStatus[] = ['open', 'in_progress', 'done'];

const STATUS_ICONS = {
  open: Circle,
  in_progress: Clock,
  done: Check,
} as const;

export function ActionItemRow({ item, participants, onUpdate, onDelete, readOnly }: ActionItemRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(item.description);

  const StatusIcon = STATUS_ICONS[item.status];
  const nextStatus = STATUS_CYCLE[(STATUS_CYCLE.indexOf(item.status) + 1) % STATUS_CYCLE.length];

  const handleSave = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== item.description) {
      onUpdate(item.id, { description: trimmed });
    }
    setIsEditing(false);
  };

  return (
    <div className={cn(
      'group flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--color-gray-1)] bg-[var(--color-surface)] p-3',
      item.status === 'done' && 'opacity-60'
    )}>
      {/* Status toggle */}
      <button
        onClick={() => !readOnly && onUpdate(item.id, { status: nextStatus })}
        disabled={readOnly}
        className={cn(
          'mt-0.5 shrink-0 rounded-full p-0.5 transition-colors',
          readOnly && 'cursor-default',
          item.status === 'done'
            ? 'text-[var(--color-success)]'
            : item.status === 'in_progress'
              ? 'text-[var(--color-navy)]'
              : 'text-[var(--color-gray-4)] hover:text-[var(--color-gray-6)]'
        )}
        title={readOnly ? item.status.replace('_', ' ') : `Mark as ${nextStatus.replace('_', ' ')}`}
      >
        <StatusIcon size={16} />
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') { setEditText(item.description); setIsEditing(false); }
            }}
            autoFocus
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-gray-2)] px-2 py-1 text-sm focus:border-[var(--color-navy)] focus:outline-none focus:ring-1 focus:ring-[var(--color-navy)]"
          />
        ) : (
          <p
            onClick={() => !readOnly && setIsEditing(true)}
            className={cn(
              'text-sm text-[var(--color-gray-8)]',
              !readOnly && 'cursor-pointer',
              item.status === 'done' && 'line-through'
            )}
          >
            {item.description}
          </p>
        )}

        <div className="mt-1 flex items-center gap-2 text-xs text-[var(--color-gray-4)]">
          {/* Assignee */}
          <select
            value={item.assignee || ''}
            onChange={(e) => onUpdate(item.id, { assignee: e.target.value || null })}
            disabled={readOnly}
            className={cn(
              'max-w-[120px] truncate rounded border-0 bg-transparent p-0 text-xs text-[var(--color-gray-4)] focus:outline-none',
              readOnly ? 'cursor-default' : 'hover:text-[var(--color-gray-6)] cursor-pointer'
            )}
          >
            <option value="">Unassigned</option>
            {participants.map((p) => (
              <option key={p.id} value={p.display_name}>
                {p.display_name}
              </option>
            ))}
          </select>

          {/* Due date */}
          <input
            type="date"
            value={item.due_date || ''}
            onChange={(e) => onUpdate(item.id, { due_date: e.target.value || null })}
            disabled={readOnly}
            className={cn(
              'rounded border-0 bg-transparent p-0 text-xs text-[var(--color-gray-4)] focus:outline-none',
              readOnly ? 'cursor-default' : 'hover:text-[var(--color-gray-6)] cursor-pointer'
            )}
          />
        </div>
      </div>

      {/* Delete */}
      {!readOnly && (
        <button
          onClick={() => onDelete(item.id)}
          className="shrink-0 rounded-[var(--radius-sm)] p-1 text-[var(--color-gray-3)] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[var(--color-error)]/10 hover:text-[var(--color-error)]"
          title="Delete action item"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}
