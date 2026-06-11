'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/utils/cn';

interface AddCardFormProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
}

export function AddCardForm({ onSubmit, disabled }: AddCardFormProps) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (focused) textareaRef.current?.focus();
  }, [focused]);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setFocused(false);
      return;
    }
    onSubmit(trimmed);
    setText('');
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      setText('');
      setFocused(false);
    }
  };

  if (disabled) return null;

  if (!focused) {
    return (
      <button
        type="button"
        onClick={() => setFocused(true)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2.5 rounded-[var(--r-md)]',
          'bg-[var(--surface-muted)] border border-dashed border-[var(--line-strong)] text-[var(--ink-4)] text-[13px]',
          'hover:border-[var(--accent)] hover:text-[var(--ink-3)] transition-colors duration-150 cursor-text text-left'
        )}
      >
        <Plus size={14} />
        <span>Add a card</span>
      </button>
    );
  }

  return (
    <textarea
      ref={textareaRef}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={handleSubmit}
      onKeyDown={handleKeyDown}
      rows={2}
      placeholder="Type your thought…"
      className={cn(
        'w-full px-3 py-2.5 rounded-[var(--r-md)] resize-none text-[16px]',
        'bg-[var(--surface)] border border-[var(--accent)] text-[var(--ink)]',
        'outline-none shadow-[0_0_0_3px_var(--accent-soft)] transition-colors duration-150',
        'placeholder:text-[var(--ink-4)]'
      )}
    />
  );
}
