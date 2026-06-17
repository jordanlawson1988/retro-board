'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Palette } from 'lucide-react';
import { cn } from '@/utils/cn';

const SWATCHES: Array<{ value: string | null; label: string }> = [
  { value: '#DD8C84', label: 'Rose' },
  { value: '#E0B265', label: 'Amber' },
  { value: '#2DA37F', label: 'Emerald' },
  { value: '#5FA3CC', label: 'Sky' },
  { value: '#8270C8', label: 'Violet' },
  { value: null,       label: 'None' },
];

interface CardColorPickerProps {
  currentColor: string | null;
  onSelectColor: (color: string | null) => void;
  onOpenChange?: (open: boolean) => void;
  iconClassName?: string;
  iconHoverClassName?: string;
}

export function CardColorPicker({ currentColor, onSelectColor, onOpenChange }: CardColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const setOpen = useCallback((open: boolean) => {
    setIsOpen(open);
    onOpenChange?.(open);
  }, [onOpenChange]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, setOpen]);

  return (
    <div className="relative" ref={pickerRef}>
      <button
        onClick={() => setOpen(!isOpen)}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--r-md)] text-[var(--ink-4)] transition-[background-color,color] duration-150 hover:bg-[var(--surface-muted)] hover:text-[var(--ink-3)] sm:min-h-0 sm:min-w-0 sm:h-7 sm:w-7 sm:rounded-[var(--r-sm)]"
        aria-label="Change card color"
      >
        <Palette size={16} className="sm:size-3.5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-30 mt-1 flex max-w-[248px] flex-wrap gap-1.5 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] p-2 shadow-[var(--shadow-md)] sm:max-w-none sm:flex-nowrap">
          {SWATCHES.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => {
                onSelectColor(s.value);
                setOpen(false);
              }}
              aria-label={s.label}
              className={cn(
                'h-9 w-9 rounded-full border transition-colors duration-150 sm:h-6 sm:w-6',
                currentColor === s.value
                  ? 'border-[var(--ink)] ring-2 ring-[var(--ink)]/20'
                  : 'border-[var(--line)] hover:border-[var(--line-strong)]'
              )}
              style={s.value ? { background: s.value } : { background: 'var(--surface-muted)' }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
