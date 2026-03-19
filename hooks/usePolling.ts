'use client';

import { useEffect, useRef } from 'react';
import { useBoardStore } from '@/stores/boardStore';

export function usePolling(boardId: string | undefined, intervalMs: number, enabled: boolean) {
  const fetchBoard = useBoardStore((s) => s.fetchBoard);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!boardId || !enabled) return;

    // Start polling
    intervalRef.current = setInterval(() => {
      fetchBoard(boardId);
    }, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [boardId, intervalMs, enabled, fetchBoard]);
}
