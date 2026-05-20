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
        className="inline-flex items-center justify-center w-7 h-7 rounded-[var(--r-sm)] text-[var(--ink-4)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink-3)] transition-[background-color,color] duration-150"
        aria-label="Change card color"
      >
        <Palette size={14} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-30 mt-1 flex gap-1.5 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] p-2 shadow-[var(--shadow-md)]">
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
                'w-6 h-6 rounded-full border transition-colors duration-150',
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
