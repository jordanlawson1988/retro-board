'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Palette, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { CARD_COLORS } from '@/utils/constants';

interface CardColorPickerProps {
  currentColor: string | null;
  onSelectColor: (color: string | null) => void;
  onOpenChange?: (open: boolean) => void;
  iconClassName?: string;
  iconHoverClassName?: string;
}

export function CardColorPicker({ currentColor, onSelectColor, onOpenChange, iconClassName, iconHoverClassName }: CardColorPickerProps) {
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
        className={cn('rounded-[var(--radius-sm)] p-1', iconClassName || 'text-[var(--color-gray-4)]', 'hover:bg-[var(--color-gray-1)]', iconHoverClassName || 'hover:text-[var(--color-gray-6)]')}
        aria-label="Change card color"
      >
        <Palette size={12} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-30 mt-1 flex gap-1 rounded-[var(--radius-md)] border border-[var(--color-gray-1)] bg-[var(--color-surface)] p-2 shadow-lg">
          {CARD_COLORS.map((c) => (
            <button
              key={c.name}
              onClick={() => {
                onSelectColor(c.value);
                setOpen(false);
              }}
              className={cn(
                'h-6 w-6 rounded-full border-2 transition-transform hover:scale-110',
                currentColor === c.value
                  ? 'border-[var(--color-navy)]'
                  : 'border-[var(--color-gray-2)]'
              )}
              style={{ backgroundColor: c.value || '#ffffff' }}
              title={c.name}
              aria-label={`Set color to ${c.name}`}
            >
              {c.value === null && (
                <X size={14} className="mx-auto text-[var(--color-gray-4)]" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
