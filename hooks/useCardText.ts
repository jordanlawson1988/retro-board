'use client';

import { useCallback } from 'react';
import { useBoardStore } from '@/stores/boardStore';
import { displayCardText } from '@/utils/cardText';
import type { Card } from '@/types';

/** `displayCardText` bound to the current board's mode, so views need no mode prop. */
export function useCardText(): (card: Card) => string {
  const mode = useBoardStore((s) => s.board?.mode);
  return useCallback((card: Card) => displayCardText(card, mode), [mode]);
}
