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
      className="fixed right-4 bottom-[84px] w-[52px] h-[52px] rounded-full grid place-items-center border-none cursor-pointer text-[var(--on-accent)] shadow-[var(--shadow-lg)] z-20 active:translate-y-px transition-transform duration-75"
      style={{ background: 'var(--accent)' }}
    >
      <Plus size={22} />
    </button>
  );
}
