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
      'group flex items-start gap-2 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] p-3',
      item.status === 'done' && 'opacity-60'
    )}>
      {/* Status toggle */}
      <button
        onClick={() => !readOnly && onUpdate(item.id, { status: nextStatus })}
        disabled={readOnly}
        className={cn(
          'grid min-h-11 min-w-11 shrink-0 place-items-center rounded-full transition-colors md:mt-0.5 md:min-h-0 md:min-w-0 md:p-0.5',
          readOnly && 'cursor-default',
          item.status === 'done'
            ? 'text-[var(--success)]'
            : item.status === 'in_progress'
              ? 'text-[var(--accent)]'
              : 'text-[var(--ink-3)] hover:text-[var(--ink)]'
        )}
        title={readOnly ? item.status.replace('_', ' ') : `Mark as ${nextStatus.replace('_', ' ')}`}
      >
        <StatusIcon size={16} />
      </button>

      {/* Content */}
      <div className="min-w-0 flex-1">
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
            className="w-full rounded-[var(--r-sm)] border border-[var(--line)] bg-[var(--bg-sunken)] px-2 py-1 text-[16px] text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] md:text-sm"
          />
        ) : (
          <p
            onClick={() => !readOnly && setIsEditing(true)}
            className={cn(
              'text-sm text-[var(--ink)]',
              !readOnly && 'cursor-pointer',
              item.status === 'done' && 'line-through'
            )}
          >
            {item.description}
          </p>
        )}

        <div className="mt-1 flex items-center gap-2 text-xs text-[var(--ink-3)]">
          {/* Assignee */}
          <select
            value={item.assignee || ''}
            onChange={(e) => onUpdate(item.id, { assignee: e.target.value || null })}
            disabled={readOnly}
            className={cn(
              'max-w-[120px] truncate rounded border-0 bg-transparent p-0 text-[16px] text-[var(--ink-3)] focus:outline-none md:text-xs',
              readOnly ? 'cursor-default' : 'cursor-pointer hover:text-[var(--ink-2)]'
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
            value={item.due_date ? item.due_date.slice(0, 10) : ''}
            onChange={(e) => onUpdate(item.id, { due_date: e.target.value || null })}
            disabled={readOnly}
            className={cn(
              'rounded border-0 bg-transparent p-0 text-[16px] text-[var(--ink-3)] focus:outline-none md:text-xs',
              readOnly ? 'cursor-default' : 'cursor-pointer hover:text-[var(--ink-2)]'
            )}
          />
        </div>
      </div>

      {/* Delete — always visible on touch, hover-revealed on desktop */}
      {!readOnly && (
        <button
          onClick={() => onDelete(item.id)}
          aria-label="Delete action item"
          className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-[var(--r-sm)] text-[var(--ink-3)] transition-opacity hover:bg-[color-mix(in_oklab,var(--danger)_12%,transparent)] hover:text-[var(--danger)] md:min-h-0 md:min-w-0 md:p-1 md:opacity-0 md:group-hover:opacity-100"
          title="Delete action item"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}
