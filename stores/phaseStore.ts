import { create } from 'zustand';
import { useBoardStore, failWrite } from '@/stores/boardStore';
import { applyPhaseChanged, type PhaseTarget } from '@/lib/phases';
import type { PhaseId } from '@/lib/constants/phases';
import type { Board } from '@/types';

const NETWORK_ERROR = 'Could not reach the server. Check your connection and try again.';
const WRITE_ERROR_MS = 6000;
const JSON_HEADERS = { 'Content-Type': 'application/json' };

interface PhaseState {
  moving: boolean;
  /** Presence client ids that are ready for the current phase. */
  readyIds: string[];
  onlineTotal: number;
  /** The phase this browser last marked itself ready for. Stale once the board phase moves on. */
  iAmReadyFor: PhaseId | null;
  readyBoardId: string | null;
  movePhase: (to: PhaseTarget) => Promise<void>;
  setDeadline: (deadline: string | null) => Promise<void>;
  setReadySummary: (s: { readyIds: string[]; total: number }) => void;
  setReady: (ready: boolean) => void;
}

/** The phase to broadcast as ready: null unless I am ready for this board's current phase. */
export function currentReadyPhase(
  s: Pick<PhaseState, 'iAmReadyFor' | 'readyBoardId'>,
  board: Pick<Board, 'id' | 'phase'> | null,
): PhaseId | null {
  if (!board || !board.phase) return null;
  return s.iAmReadyFor === board.phase && s.readyBoardId === board.id ? s.iAmReadyFor : null;
}

/** POST to the phase route and apply the answer. No optimistic change: the server decides. */
async function postPhase(body: Record<string, unknown>, fallback: string): Promise<void> {
  const { board } = useBoardStore.getState();
  if (!board || board.mode !== 'guided') return;
  let res: Response;
  try {
    res = await fetch(`/api/boards/${board.id}/phase`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    });
  } catch (err) {
    // Existing store writes let a thrown fetch escape unannounced; here the user also sees why.
    useBoardStore.setState({ lastWriteError: NETWORK_ERROR });
    setTimeout(() => {
      if (useBoardStore.getState().lastWriteError === NETWORK_ERROR) useBoardStore.setState({ lastWriteError: null });
    }, WRITE_ERROR_MS);
    throw err;
  }
  if (!res.ok) throw await failWrite(res, fallback);
  const data = await res.json().catch(() => null);
  useBoardStore.setState((state) => ({
    board: state.board ? applyPhaseChanged(state.board, data) : null,
  }));
}

export const usePhaseStore = create<PhaseState>((set, get) => ({
  moving: false,
  readyIds: [],
  onlineTotal: 0,
  iAmReadyFor: null,
  readyBoardId: null,

  movePhase: async (to) => {
    if (get().moving) return;
    const { board } = useBoardStore.getState();
    if (!board || board.mode !== 'guided' || !board.phase) return;
    set({ moving: true });
    try {
      await postPhase({ action: 'move', from: board.phase, to }, 'Failed to change phase');
    } finally {
      set({ moving: false });
    }
  },

  setDeadline: async (deadline) => {
    await postPhase({ action: 'set-deadline', deadline }, 'Failed to set the deadline');
  },

  setReadySummary: ({ readyIds, total }) => set({ readyIds, onlineTotal: total }),

  setReady: (ready) => {
    const { board } = useBoardStore.getState();
    if (!board || board.mode !== 'guided' || !board.phase) return;
    set(ready ? { iAmReadyFor: board.phase, readyBoardId: board.id } : { iAmReadyFor: null, readyBoardId: null });
  },
}));
