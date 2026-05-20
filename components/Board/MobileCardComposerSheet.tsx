'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Send } from 'lucide-react';
import { Button } from '@/components/common';

interface MobileCardComposerSheetProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (text: string) => Promise<void> | void;
  columnTitle: string;
}

export function MobileCardComposerSheet({
  open,
  onClose,
  onSubmit,
  columnTitle,
}: MobileCardComposerSheetProps) {
  const [text, setText] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => ref.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    await onSubmit(trimmed);
    setText('');
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-30 flex flex-col justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={`Add card to ${columnTitle}`}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-[oklch(0.15_0.01_260/0.40)] backdrop-blur-[2px]"
      />

      {/* Sheet */}
      <div className="relative w-full bg-[var(--bg-elev)] border-t border-[var(--line)] rounded-t-[var(--r-2xl)] p-5 pb-7 shadow-[var(--shadow-lg)]">
        {/* Drag handle */}
        <div
          aria-hidden
          className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--line-strong)]"
        />

        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[15px]">Add to {columnTitle}</h3>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="text-[var(--ink-3)] p-1 rounded-full hover:bg-[var(--surface-muted)] transition-colors duration-120"
          >
            <X size={18} />
          </button>
        </div>

        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What's on your mind?"
          rows={4}
          className="w-full px-3 py-2.5 text-[16px] rounded-[var(--r-md)] bg-[var(--surface)] border border-[var(--line)] text-[var(--ink)] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-soft)] transition-[border-color,box-shadow] duration-150 resize-none placeholder:text-[var(--ink-4)]"
        />

        <div className="flex gap-2 mt-4">
          <Button
            variant="ghost"
            size="md"
            onClick={onClose}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            variant="accent"
            size="md"
            onClick={handleSubmit}
            disabled={!text.trim()}
            className="flex-1"
          >
            <Send size={14} />
            Share
          </Button>
        </div>
      </div>
    </div>
  );
}
