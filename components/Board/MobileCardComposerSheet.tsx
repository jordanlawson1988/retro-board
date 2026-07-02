'use client';

import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/common';
import { MobileSheet } from '@/components/common/Sheet';
import { useVisualViewportInset } from '@/hooks/useVisualViewportInset';

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
  const keyboardInset = useVisualViewportInset();

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => ref.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [open]);

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
    // Escape is handled by MobileSheet (useDismissable)
  };

  return (
    <MobileSheet
      open={open}
      onClose={onClose}
      label={`Add card to ${columnTitle}`}
      title={`Add to ${columnTitle}`}
      bottomOffset={keyboardInset}
    >
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="What's on your mind?"
        rows={4}
        className="w-full px-3 py-2.5 text-[16px] rounded-[var(--r-md)] bg-[var(--bg-sunken)] border border-[var(--line)] text-[var(--ink)] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-soft)] transition-[border-color,box-shadow] duration-150 resize-none placeholder:text-[var(--ink-4)]"
      />

      <div className="mt-4 flex gap-2">
        <Button variant="ghost" size="md" onClick={onClose} className="flex-1">
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
    </MobileSheet>
  );
}
