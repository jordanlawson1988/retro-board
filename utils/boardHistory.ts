import type { BoardHistoryEntry } from '@/types';

const STORAGE_KEY = 'retro-board-history';
const MAX_ENTRIES = 50;

export function getBoardHistory(): BoardHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const entries: BoardHistoryEntry[] = JSON.parse(raw);
    return entries.sort((a, b) => new Date(b.lastVisited).getTime() - new Date(a.lastVisited).getTime());
  } catch {
    return [];
  }
}

export function saveBoardToHistory(entry: BoardHistoryEntry): void {
  try {
    const entries = getBoardHistory();
    const existingIndex = entries.findIndex((e) => e.boardId === entry.boardId);

    if (existingIndex >= 0) {
      entries[existingIndex] = { ...entries[existingIndex], ...entry };
    } else {
      entries.unshift(entry);
    }

    // Cap at MAX_ENTRIES, drop oldest
    const trimmed = entries
      .sort((a, b) => new Date(b.lastVisited).getTime() - new Date(a.lastVisited).getTime())
      .slice(0, MAX_ENTRIES);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage unavailable — silently ignore
  }
}

export function clearBoardHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // silently ignore
  }
}
