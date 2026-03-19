'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, Check, X } from 'lucide-react';
import { COLUMN_COLORS, MAX_COLUMNS } from '@/utils/constants';

interface AddColumnButtonProps {
  columnCount: number;
  onAddColumn: (title: string, color: string) => void;
}

export function AddColumnButton({ columnCount, onAddColumn }: AddColumnButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const atLimit = columnCount >= MAX_COLUMNS;

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    // Cycle through colors based on current column count
    const color = COLUMN_COLORS[columnCount % COLUMN_COLORS.length];
    onAddColumn(trimmed, color);
    setTitle('');
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
    if (e.key === 'Escape') {
      setTitle('');
      setIsOpen(false);
    }
  };

  if (atLimit) return null;

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex min-h-[300px] w-[85vw] shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-gray-2)] bg-[var(--color-surface-subtle)] px-6 py-8 text-[var(--color-gray-4)] transition-colors hover:border-[var(--color-gray-3)] hover:bg-[var(--color-surface-dim)] hover:text-[var(--color-gray-6)] sm:w-auto sm:shrink sm:min-w-[200px]"
      >
        <Plus size={24} />
        <span className="text-sm font-medium">Add Column</span>
        <span className="text-xs">{columnCount}/{MAX_COLUMNS}</span>
      </button>
    );
  }

  return (
    <div className="flex min-h-[300px] w-[85vw] shrink-0 snap-start flex-col rounded-[var(--radius-lg)] border border-[var(--color-navy)] bg-[var(--color-surface)] p-4 sm:w-auto sm:shrink sm:min-w-[200px]">
      <p className="mb-2 text-sm font-medium text-[var(--color-gray-7)]">New Column</p>
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Column name..."
        maxLength={40}
        className="w-full rounded-[var(--radius-md)] border border-[var(--color-gray-2)] px-3 py-2 text-base text-[var(--color-gray-8)] placeholder:text-[var(--color-gray-3)] focus:border-[var(--color-navy)] focus:outline-none focus:ring-1 focus:ring-[var(--color-navy)]"
      />
      <div className="mt-3 flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={!title.trim()}
          className="flex items-center gap-1 rounded-[var(--radius-md)] bg-[var(--color-navy)] px-3 py-2 text-sm text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Check size={14} />
          Add
        </button>
        <button
          onClick={() => {
            setTitle('');
            setIsOpen(false);
          }}
          className="flex items-center gap-1 rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--color-gray-5)] hover:bg-[var(--color-gray-1)]"
        >
          <X size={14} />
          Cancel
        </button>
      </div>
    </div>
  );
}
