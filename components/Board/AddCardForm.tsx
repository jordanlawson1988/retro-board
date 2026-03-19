'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/utils/cn';

interface AddCardFormProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
}

export function AddCardForm({ onSubmit, disabled }: AddCardFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setText('');
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      setIsOpen(false);
      setText('');
    }
  };

  if (disabled) return null;

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          'flex w-full items-center gap-2 rounded-[var(--radius-md)] border-2 border-dashed',
          'border-[var(--color-gray-2)] px-3 py-2.5 text-sm text-[var(--color-gray-4)]',
          'transition-colors hover:border-[var(--color-gray-3)] hover:text-[var(--color-gray-5)]'
        )}
      >
        <Plus size={16} />
        Add a card
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type your thought..."
        rows={3}
        className={cn(
          'w-full resize-none rounded-[var(--radius-md)] border border-[var(--color-gray-2)]',
          'bg-[var(--color-surface)] px-3 py-2 text-base text-[var(--color-gray-8)]',
          'placeholder:text-[var(--color-gray-3)]',
          'focus:border-[var(--color-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)] focus:ring-offset-1'
        )}
      />
      <div className="flex items-center justify-end sm:justify-between">
        <p className="hidden text-xs text-[var(--color-gray-4)] sm:block">
          Enter to submit, Shift+Enter for new line
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setIsOpen(false);
              setText('');
            }}
            className="rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--color-gray-5)] hover:bg-[var(--color-gray-1)]"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!text.trim()}
            className={cn(
              'rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium text-white',
              'bg-[var(--color-navy)] hover:bg-[var(--color-navy-hover)]',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
