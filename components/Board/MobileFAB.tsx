'use client';

import { Plus } from 'lucide-react';

interface MobileFABProps {
  onClick: () => void;
  ariaLabel?: string;
}

export function MobileFAB({ onClick, ariaLabel = 'Add card' }: MobileFABProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="absolute right-4 bottom-[calc(76px+var(--safe-bottom))] w-[52px] h-[52px] rounded-full grid place-items-center border-none cursor-pointer text-[var(--on-accent)] shadow-[var(--shadow-lg)] z-40 active:scale-95 transition-transform duration-75"
      style={{ background: 'var(--accent)' }}
    >
      <Plus size={22} />
    </button>
  );
}
