'use client';

import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { DEFAULT_BOARD_SETTINGS } from '@/utils/constants';
import { BOARD_TEMPLATES } from '@/utils/templates';
import { saveBoardToHistory } from '@/utils/boardHistory';
import { mergeIncomingCard } from '@/lib/mergeIncomingCard';
import { revertSettingsPatch } from '@/lib/settingsRevert';
import { useAppSettingsStore } from '@/stores/appSettingsStore';
import { BOARD_ACCESS } from '@/lib/constants/board-access';
import { withPhaseDefaults } from '@/lib/phases';
import { createKeyedCoalescer } from '@/lib/coalescedRunner';
import { FINAL_PHASE, GUIDED_MODE, type BoardMode } from '@/lib/constants/phases';
import type { BoardAccess } from '@/types';
import type { Board, Column, Card, Vote, ActionItem, Participant, BoardTemplate, BoardSettings, ConnectionStatus } from '@/types';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** Who the server says this browser is on this board (GET /api/boards/:id). */
export interface YouAre {
  participantId: string | null;
  isFacilitator: boolean;
  /** True when the server resolved a participant for this browser (v2: from the cookie). */
  joined: boolean;
}

// Boards where this page session already ran the cookie-establishing join, so a
// failed or repeated join can never loop fetchBoard.
const autoJoinTried = new Set<string>();

/** Join with an existing display name; resolves to the participant or null on any failure. */
async function postJoin(boardId: string, displayName: string): Promise<Participant | null> {
  try {
    const res = await fetch(`/api/boards/${boardId}/join`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ participantId: crypto.randomUUID(), displayName }),
    });
    if (!res.ok) return null;
    const { participant } = await res.json();
    return (participant as Participant) ?? null;
  } catch {
    return null;
  }
}

export const WRITE_ERROR_MS = 6000;

/**
 * The one way to refetch a guided board: per board, never two GETs in flight, and a trigger that
 * arrives mid-flight gets one trailing run. Without it an older response could land last and
 * overwrite a newer phase.
 */
export const refetchBoardCoalesced = createKeyedCoalescer((boardId) => useBoardStore.getState().fetchBoard(boardId));

/**
 * Turn a failed write response into an Error carrying the server's message,
 * surface it via lastWriteError, and on a 401 for a v2 board drop the local
 * participant so the join modal shows. Callers roll back their optimistic
 * change first, then throw the returned error.
 */
export async function failWrite(res: Response, fallback: string): Promise<Error> {
  const data = await res.json().catch(() => null);
  const message: string = data?.error || fallback;
  const { board } = useBoardStore.getState();
  if (res.status === 401 && board?.trust_version === 2) {
    try { localStorage.removeItem(`retro-pid-${board.id}`); } catch { /* ignore */ }
    useBoardStore.setState({ currentParticipantId: null, youAre: null, lastWriteError: message });
  } else {
    useBoardStore.setState({ lastWriteError: message });
  }
  setTimeout(() => {
    if (useBoardStore.getState().lastWriteError === message) useBoardStore.setState({ lastWriteError: null });
  }, WRITE_ERROR_MS);
  // A refused write on a guided board usually means the phase moved under us: pull the fresh phase.
  if (res.status === 409 && board?.mode === GUIDED_MODE) {
    await refetchBoardCoalesced(board.id); // never rejects; the message is already surfaced
  }
  return new Error(message);
}

interface BoardState {
  board: Board | null;
  columns: Column[];
  cards: Card[];
  votes: Vote[];
  actionItems: ActionItem[];
  participants: Participant[];
  connectionStatus: ConnectionStatus;
  loading: boolean;
  error: string | null;
  currentParticipantId: string | null;
  youCanFacilitate: boolean;
  youAre: YouAre | null;
  /** 'completed-closed' = the board is completed and this browser was not part of it. */
  access: BoardAccess;
  lastWriteError: string | null;
  clearWriteError: () => void;

  // Board lifecycle
  createBoard: (title: string, description: string | null, template: BoardTemplate,
    displayName?: string,
    options?: { mode?: BoardMode; anonymous?: boolean },
  ) => Promise<string>;
  fetchBoard: (boardId: string) => Promise<void>;
  updateSettings: (settings: Partial<BoardSettings>) => Promise<void>;
  completeBoard: () => Promise<void>;
  reset: () => void;

  // Participants
  joinBoard: (boardId: string, displayName: string) => Promise<void>;
  updateParticipant: (participantId: string, updates: Partial<Pick<Participant, 'is_admin'>>) => Promise<void>;
  removeParticipant: (participantId: string) => Promise<void>;

  // Columns
  addColumn: (title: string, color: string, description?: string) => Promise<void>;
  updateColumn: (columnId: string, updates: Partial<Pick<Column, 'title' | 'color' | 'description' | 'sort_by'>>) => Promise<void>;
  deleteColumn: (columnId: string) => Promise<void>;

  // Cards
  addCard: (columnId: string, text: string) => Promise<void>;
  updateCard: (cardId: string, updates: Partial<Pick<Card, 'text' | 'color'>>) => Promise<void>;
  deleteCard: (cardId: string) => Promise<void>;
  moveCard: (cardId: string, targetColumnId: string, newPosition: number) => Promise<void>;
  combineCards: (parentCardId: string, childCardId: string) => Promise<void>;
  uncombineCard: (childCardId: string) => Promise<void>;

  // Voting
  toggleVote: (cardId: string) => Promise<void>;

  // Reactions
  toggleReaction: (cardId: string, emoji: string) => Promise<void>;

  // Action Items
  addActionItem: (description: string, assignee?: string, dueDate?: string) => Promise<void>;
  updateActionItem: (itemId: string, updates: Partial<Pick<ActionItem, 'description' | 'assignee' | 'due_date' | 'status'>>) => Promise<void>;
  deleteActionItem: (itemId: string) => Promise<void>;

  // Presence
  onlineParticipantIds: string[];
  setOnlineParticipantIds: (ids: string[]) => void;
}

const initialState = {
  board: null as Board | null,
  columns: [] as Column[],
  cards: [] as Card[],
  votes: [] as Vote[],
  actionItems: [] as ActionItem[],
  participants: [] as Participant[],
  connectionStatus: 'connected' as ConnectionStatus,
  loading: false,
  error: null as string | null,
  currentParticipantId: null as string | null,
  youCanFacilitate: false,
  youAre: null as YouAre | null,
  access: BOARD_ACCESS[0] as BoardAccess,
  lastWriteError: null as string | null,
  onlineParticipantIds: [] as string[],
};

export const useBoardStore = create<BoardState>((set, get) => ({
  ...initialState,

  createBoard: async (title, description, template, displayName?, options?) => {
    const boardId = nanoid(10);
    const templateDef = BOARD_TEMPLATES.find((t) => t.id === template);

    const columns = templateDef && templateDef.columns.length > 0
      ? templateDef.columns.map((col, i) => ({
          id: nanoid(10),
          title: col.title,
          description: col.description || null,
          color: col.color,
          position: i,
        }))
      : [];

    const participant = displayName ? { displayName } : undefined;

    const res = await fetch('/api/boards', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        id: boardId,
        title,
        description,
        template,
        settings: {
          ...DEFAULT_BOARD_SETTINGS,
          ...(useAppSettingsStore?.getState?.()?.settings?.default_board_settings ?? {}),
          ...(options?.mode === GUIDED_MODE ? { anonymous_cards: options.anonymous ?? true } : {}),
        },
        ...(options?.mode ? { mode: options.mode } : {}),
        columns,
        participant,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create board');
    }

    // The server generated the creator's participant id (and set the cookie).
    const { participantId } = (await res.json()) as { participantId: string | null };

    // Update local state for auto-joined creator
    if (displayName && participantId) {
      localStorage.setItem(`retro-pid-${boardId}`, participantId);
      set((state) => ({
        currentParticipantId: participantId,
        participants: [
          ...state.participants,
          {
            id: participantId,
            board_id: boardId,
            display_name: displayName,
            is_admin: true,
            user_id: null,
            joined_at: new Date().toISOString(),
            last_seen: new Date().toISOString(),
          },
        ],
      }));
    }

    saveBoardToHistory({
      boardId,
      title,
      createdAt: new Date().toISOString(),
      lastVisited: new Date().toISOString(),
      isCompleted: false,
    });

    return boardId;
  },

  fetchBoard: async (boardId) => {
    const currentBoard = get().board;
    const isRefresh = currentBoard !== null && currentBoard.id === boardId;
    if (!isRefresh) {
      set({ loading: true, error: null });
    }

    // The stored participant id is sent for legacy (v1) boards, where the server has no other
    // way to know who this is. Boards on the signed-cookie model ignore it.
    let claimedPid: string | null = null;
    try { claimedPid = localStorage.getItem(`retro-pid-${boardId}`); } catch { /* ignore */ }
    const res = await fetch(
      `/api/boards/${boardId}${claimedPid ? `?pid=${encodeURIComponent(claimedPid)}` : ''}`
    );

    if (!res.ok) {
      // A transient server failure during a background refresh must not blank a loaded board.
      if (isRefresh && res.status >= 500) return;
      const err = await res.json();
      set({ loading: false, error: err.error || 'Board not found' });
      return;
    }

    const { board: rawBoard, columns, cards, votes, actionItems, participants, yourParticipantId, youCanFacilitate, youAre, access } = await res.json();
    const board = withPhaseDefaults(rawBoard);

    // Completed and not part of it: keep only the stub. No history entry, no participant.
    if (access === BOARD_ACCESS[1]) {
      set({
        ...initialState,
        board: board as Board,
        access: BOARD_ACCESS[1],
        youAre: { participantId: null, isFacilitator: false, joined: false },
        loading: false,
      });
      return;
    }

    const storageKey = `retro-pid-${boardId}`;
    let resolvedParticipantId: string | null;

    if (board.trust_version === 2) {
      // v2: the server's cookie is the only identity. localStorage is never trusted.
      const serverPid: string | null = youAre?.participantId ?? null;
      const knownName = (id: string | null) =>
        (participants as Participant[] | undefined)?.find((p) => p.id === id)?.display_name;

      if (!serverPid) {
        localStorage.removeItem(storageKey);
        const name = knownName(yourParticipantId ?? null);
        if (yourParticipantId && name && !autoJoinTried.has(boardId)) {
          // Signed-in user matched to an existing participant but no cookie here: join to get one.
          autoJoinTried.add(boardId);
          if (await postJoin(boardId, name)) {
            await get().fetchBoard(boardId);
            return;
          }
        }
        resolvedParticipantId = null;
      } else {
        resolvedParticipantId = serverPid;
        localStorage.setItem(storageKey, serverPid);
      }
    } else {
      // v1: prefer the server-resolved participant (matched via the authenticated
      // user's user_id) over localStorage, so owners/facilitators keep their role
      // when opening a board from a new device or after clearing site data.
      const stored = localStorage.getItem(storageKey);
      resolvedParticipantId = yourParticipantId || stored || null;
      if (yourParticipantId && yourParticipantId !== stored) {
        localStorage.setItem(storageKey, yourParticipantId);
      }
    }

    saveBoardToHistory({
      boardId,
      title: board.title,
      createdAt: board.created_at,
      lastVisited: new Date().toISOString(),
      isCompleted: !!board.archived_at,
    });

    set({
      board,
      columns: columns || [],
      cards: cards || [],
      votes: votes || [],
      actionItems: actionItems || [],
      participants: participants || [],
      currentParticipantId: resolvedParticipantId,
      access: BOARD_ACCESS[0],
      youCanFacilitate: !!youCanFacilitate,
      youAre: youAre
        ? {
            participantId: youAre.participantId ?? null,
            isFacilitator: !!youAre.isFacilitator,
            joined: youAre.joined ?? (youAre.participantId ?? null) !== null,
          }
        : null,
      loading: false,
    });
  },

  updateSettings: async (settingsUpdate) => {
    const { board } = get();
    if (!board) return;

    const prevSettings = board.settings;
    const newSettings = { ...board.settings, ...settingsUpdate };

    // Optimistic update
    set({ board: { ...board, settings: newSettings } });

    const res = await fetch(`/api/boards/${board.id}`, {
      method: 'PATCH',
      headers: JSON_HEADERS,
      // Only the keys this action changed: the server merges them, so a concurrent change to a
      // different key (a co-facilitator's reveal, say) is never overwritten by our stale copy.
      body: JSON.stringify({ settings: settingsUpdate }),
    });

    if (!res.ok) {
      // Undo only this call's keys on the board as it is now, so an event that landed while the
      // request was in flight (a phase move, a rename) is not rolled back with it. If the user has
      // since moved to another board, that board is left untouched.
      set((state) => ({
        board: state.board && state.board.id === board.id ? revertSettingsPatch(state.board, prevSettings, settingsUpdate) : state.board,
      }));
      throw await failWrite(res, 'Failed to update settings');
    }
  },

  completeBoard: async () => {
    const { board } = get();
    if (!board) return;

    const archivedAt = new Date().toISOString();
    const completedSettings = { ...board.settings, card_visibility: 'visible' as const, board_locked: true };

    // Optimistic update
    set({
      board: {
        ...board,
        archived_at: archivedAt,
        settings: completedSettings,
        ...(board.mode === GUIDED_MODE ? { phase: FINAL_PHASE } : {}),
      },
    });

    saveBoardToHistory({
      boardId: board.id,
      title: board.title,
      createdAt: board.created_at,
      lastVisited: new Date().toISOString(),
      isCompleted: true,
    });

    const res = await fetch(`/api/boards/${board.id}`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ action: 'complete' }),
    });

    if (!res.ok) {
      // Revert
      set({ board });
      throw await failWrite(res, 'Failed to complete board');
    }
  },

  joinBoard: async (boardId, displayName) => {
    // Check if already joined (e.g., creator who auto-joined in createBoard,
    // or user whose participant was resolved by fetchBoard via user_id)
    // On v2 boards localStorage proves nothing: only the server cookie counts.
    const stored = get().board?.trust_version === 2 ? null : localStorage.getItem(`retro-pid-${boardId}`);
    if (stored) {
      const { participants } = get();
      const existing = participants.find((p) => p.id === stored);
      if (existing) {
        set({ currentParticipantId: stored });
        return;
      }
    }

    const participantId = crypto.randomUUID();

    // The server decides identity and admin status: it may reuse an existing
    // participant, generate a new id, or promote an owner/facilitator.
    const res = await fetch(`/api/boards/${boardId}/join`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ participantId, displayName }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to join board');
    }

    // Use the participant the server actually returned — it may have reused
    // an existing record (different id) or overridden is_admin.
    const { participant } = await res.json();
    const actualId: string = participant.id;
    localStorage.setItem(`retro-pid-${boardId}`, actualId);

    set((state) => {
      const existingIdx = state.participants.findIndex((p) => p.id === actualId);
      const participants = existingIdx >= 0
        ? state.participants.map((p, i) => (i === existingIdx ? participant : p))
        : [...state.participants, participant];
      return {
        currentParticipantId: actualId,
        board: participant.is_admin && state.board
          ? { ...state.board, created_by: actualId }
          : state.board,
        participants,
      };
    });

    // v2: the join response set the cookie. Refetch so cards, votes and youAre
    // are shaped for this participant before the Ably provider mounts.
    if (get().board?.trust_version === 2) {
      autoJoinTried.add(boardId);
      await get().fetchBoard(boardId);
    }
  },

  updateParticipant: async (participantId, updates) => {
    const { board, participants } = get();
    if (!board) return;

    const prev = participants.find((p) => p.id === participantId);

    // Optimistic update
    set((state) => ({
      participants: state.participants.map((p) =>
        p.id === participantId ? { ...p, ...updates } : p
      ),
    }));

    const res = await fetch(`/api/boards/${board.id}/participants`, {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify({ participantId, updates }),
    });

    if (!res.ok) {
      if (prev) set((state) => ({ participants: state.participants.map((p) => (p.id === participantId ? prev : p)) }));
      throw await failWrite(res, 'Failed to update participant');
    }
  },

  removeParticipant: async (participantId) => {
    const { board, participants } = get();
    if (!board) return;

    const prev = participants.find((p) => p.id === participantId);

    // Optimistic delete
    set((state) => ({
      participants: state.participants.filter((p) => p.id !== participantId),
    }));

    const res = await fetch(`/api/boards/${board.id}/participants`, {
      method: 'DELETE',
      headers: JSON_HEADERS,
      body: JSON.stringify({ participantId }),
    });

    if (!res.ok) {
      if (prev) set((state) => ({ participants: [...state.participants, prev] }));
      throw await failWrite(res, 'Failed to remove participant');
    }
  },

  // --- Column CRUD ---

  addColumn: async (title, color, description) => {
    const { board, columns } = get();
    if (!board) return;

    const newCol = {
      id: nanoid(10),
      title,
      description: description || null,
      color,
      position: columns.length,
    };

    // Optimistic update BEFORE fetch — Ably echo dedup will catch the duplicate
    const optimisticCol: Column = { ...newCol, board_id: board.id, created_at: new Date().toISOString(), sort_by: 'votes_desc' };
    set((state) => ({ columns: [...state.columns, optimisticCol] }));

    const res = await fetch(`/api/boards/${board.id}/columns`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(newCol),
    });

    if (!res.ok) {
      // Revert on failure
      set((state) => ({ columns: state.columns.filter((c) => c.id !== newCol.id) }));
      throw await failWrite(res, 'Failed to add column');
    }
  },

  updateColumn: async (columnId, updates) => {
    const { board, columns } = get();
    if (!board) return;

    const prev = columns.find((c) => c.id === columnId);
    // Optimistic update
    set((state) => ({
      columns: state.columns.map((c) => (c.id === columnId ? { ...c, ...updates } : c)),
    }));

    const res = await fetch(`/api/boards/${board.id}/columns`, {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify({ columnId, updates }),
    });

    if (!res.ok) {
      // Revert
      if (prev) set((state) => ({ columns: state.columns.map((c) => (c.id === columnId ? prev : c)) }));
      throw await failWrite(res, 'Failed to update column');
    }
  },

  deleteColumn: async (columnId) => {
    const { board, columns, cards } = get();
    if (!board) return;

    const prevCol = columns.find((c) => c.id === columnId);
    const prevCards = cards.filter((c) => c.column_id === columnId);

    // Optimistic delete
    set((state) => ({
      columns: state.columns.filter((c) => c.id !== columnId),
      cards: state.cards.filter((c) => c.column_id !== columnId),
    }));

    const res = await fetch(`/api/boards/${board.id}/columns`, {
      method: 'DELETE',
      headers: JSON_HEADERS,
      body: JSON.stringify({ columnId }),
    });

    if (!res.ok) {
      // Revert
      set((state) => ({
        columns: prevCol ? [...state.columns, prevCol] : state.columns,
        cards: [...state.cards, ...prevCards],
      }));
      throw await failWrite(res, 'Failed to delete column');
    }
  },

  // --- Card CRUD ---

  addCard: async (columnId, text) => {
    const { board, cards, currentParticipantId, participants } = get();
    if (!board || !currentParticipantId) return;

    const participant = participants.find((p) => p.id === currentParticipantId);
    const cardsInColumn = cards.filter((c) => c.column_id === columnId);

    const newCard = {
      id: nanoid(10),
      columnId,
      text,
      authorName: participant?.display_name || 'Anonymous',
      authorId: currentParticipantId,
      position: cardsInColumn.length,
    };

    // Optimistic update BEFORE fetch — Ably echo dedup will catch the duplicate
    const fullCard: Card = {
      id: newCard.id,
      column_id: columnId,
      board_id: board.id,
      text,
      author_name: newCard.authorName,
      author_id: currentParticipantId,
      color: null,
      position: newCard.position,
      merged_with: null,
      reactions: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_mine: true,
      text_hidden: false,
    };
    set((state) => ({ cards: [...state.cards, fullCard] }));

    const res = await fetch(`/api/boards/${board.id}/cards`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(newCard),
    });

    if (!res.ok) {
      // Revert on failure
      set((state) => ({ cards: state.cards.filter((c) => c.id !== newCard.id) }));
      throw await failWrite(res, 'Failed to add card');
    }

    // The response is shaped for us (our own text). Merge, never blindly replace.
    const created = (await res.json().catch(() => null))?.card as Card | undefined;
    if (created) {
      set((state) => ({
        cards: state.cards.map((c) => (c.id === created.id ? mergeIncomingCard(c, created) : c)),
      }));
    }
  },

  updateCard: async (cardId, updates) => {
    const { board, cards } = get();
    if (!board) return;

    const prev = cards.find((c) => c.id === cardId);
    const updatedAt = new Date().toISOString();

    // Optimistic update
    set((state) => ({
      cards: state.cards.map((c) =>
        c.id === cardId ? { ...c, ...updates, updated_at: updatedAt } : c
      ),
    }));

    const res = await fetch(`/api/boards/${board.id}/cards`, {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify({ cardId, updates }),
    });

    if (!res.ok) {
      // Revert
      if (prev) set((state) => ({ cards: state.cards.map((c) => (c.id === cardId ? prev : c)) }));
      throw await failWrite(res, 'Failed to update card');
    }

    const updated = (await res.json().catch(() => null))?.card as Card | undefined;
    if (updated) {
      set((state) => ({
        cards: state.cards.map((c) => (c.id === updated.id ? mergeIncomingCard(c, updated) : c)),
      }));
    }
  },

  deleteCard: async (cardId) => {
    const { board, cards, votes } = get();
    if (!board) return;

    const prevCard = cards.find((c) => c.id === cardId);
    const prevVotes = votes.filter((v) => v.card_id === cardId);

    // Optimistic delete
    set((state) => ({
      cards: state.cards
        .filter((c) => c.id !== cardId)
        .map((c) => c.merged_with === cardId ? { ...c, merged_with: null } : c),
      votes: state.votes.filter((v) => v.card_id !== cardId),
    }));

    const res = await fetch(`/api/boards/${board.id}/cards`, {
      method: 'DELETE',
      headers: JSON_HEADERS,
      body: JSON.stringify({ cardId }),
    });

    if (!res.ok) {
      // Revert
      set((state) => ({
        cards: prevCard ? [...state.cards, prevCard] : state.cards,
        votes: [...state.votes, ...prevVotes],
      }));
      throw await failWrite(res, 'Failed to delete card');
    }
  },

  moveCard: async (cardId, targetColumnId, newPosition) => {
    const { board, cards } = get();
    if (!board) return;

    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    // Find children that should move with parent
    const childIds = cards.filter((c) => c.merged_with === cardId).map((c) => c.id);

    // Optimistic update
    set((state) => {
      const otherCards = state.cards.filter((c) => c.id !== cardId && !childIds.includes(c.id));
      const movedCard = { ...card, column_id: targetColumnId, position: newPosition };

      const targetCards = otherCards
        .filter((c) => c.column_id === targetColumnId)
        .sort((a, b) => a.position - b.position);

      targetCards.splice(newPosition, 0, movedCard);
      const reindexed = targetCards.map((c, i) => ({ ...c, position: i }));

      // Move children to same column
      const movedChildren = state.cards
        .filter((c) => childIds.includes(c.id))
        .map((c) => ({ ...c, column_id: targetColumnId }));

      return {
        cards: [
          ...otherCards.filter((c) => c.column_id !== targetColumnId),
          ...reindexed,
          ...movedChildren,
        ],
      };
    });

    // Persist the parent card move
    const res = await fetch(`/api/boards/${board.id}/cards`, {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        cardId,
        updates: { column_id: targetColumnId, position: newPosition },
      }),
    });

    if (!res.ok) {
      // Revert on failure
      set((state) => ({
        cards: state.cards.map((c) => {
          if (c.id === cardId) return { ...c, column_id: card.column_id, position: card.position };
          if (childIds.includes(c.id)) return { ...c, column_id: card.column_id };
          return c;
        }),
      }));
      throw await failWrite(res, 'Failed to move card');
    }

    // Move children in DB too
    if (childIds.length > 0) {
      for (const childId of childIds) {
        await fetch(`/api/boards/${board.id}/cards`, {
          method: 'PATCH',
          headers: JSON_HEADERS,
          body: JSON.stringify({
            cardId: childId,
            updates: { column_id: targetColumnId },
          }),
        });
      }
    }
  },

  combineCards: async (parentCardId, childCardId) => {
    const { board, cards } = get();
    if (!board) return;

    const child = cards.find((c) => c.id === childCardId);
    const parent = cards.find((c) => c.id === parentCardId);
    if (!child || !parent) return;

    // Re-parent any existing children of the child card to the new parent
    const grandchildren = cards.filter((c) => c.merged_with === childCardId);

    // Optimistic update
    set((state) => ({
      cards: state.cards.map((c) => {
        if (c.id === childCardId) return { ...c, merged_with: parentCardId, column_id: parent.column_id };
        if (c.merged_with === childCardId) return { ...c, merged_with: parentCardId, column_id: parent.column_id };
        return c;
      }),
    }));

    // Persist child
    const res = await fetch(`/api/boards/${board.id}/cards`, {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        cardId: childCardId,
        updates: { merged_with: parentCardId, column_id: parent.column_id },
      }),
    });

    if (!res.ok) {
      // Revert
      set((state) => ({
        cards: state.cards.map((c) =>
          c.id === childCardId ? { ...c, merged_with: child.merged_with, column_id: child.column_id } : c
        ),
      }));
      throw await failWrite(res, 'Failed to combine cards');
    }

    // Re-parent grandchildren
    for (const gc of grandchildren) {
      await fetch(`/api/boards/${board.id}/cards`, {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          cardId: gc.id,
          updates: { merged_with: parentCardId, column_id: parent.column_id },
        }),
      });
    }
  },

  uncombineCard: async (childCardId) => {
    const { board, cards } = get();
    if (!board) return;

    const child = cards.find((c) => c.id === childCardId);
    if (!child || !child.merged_with) return;

    const prevMergedWith = child.merged_with;

    // Optimistic update
    set((state) => ({
      cards: state.cards.map((c) =>
        c.id === childCardId ? { ...c, merged_with: null } : c
      ),
    }));

    const res = await fetch(`/api/boards/${board.id}/cards`, {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        cardId: childCardId,
        updates: { merged_with: null },
      }),
    });

    if (!res.ok) {
      set((state) => ({
        cards: state.cards.map((c) =>
          c.id === childCardId ? { ...c, merged_with: prevMergedWith } : c
        ),
      }));
      throw await failWrite(res, 'Failed to uncombine card');
    }
  },

  // --- Voting ---

  toggleVote: async (cardId) => {
    const { board, votes, currentParticipantId } = get();
    if (!board || !currentParticipantId) return;

    const existingVote = votes.find(
      (v) => v.card_id === cardId && v.voter_id === currentParticipantId
    );

    if (!existingVote) {
      // Check global vote limit before optimistic update
      const myVoteCount = votes.filter((v) => v.voter_id === currentParticipantId).length;
      if (myVoteCount >= board.settings.max_votes_per_participant) return;
    }

    // Optimistic update
    const optimisticVoteId = existingVote?.id || crypto.randomUUID();
    if (existingVote) {
      set((state) => ({ votes: state.votes.filter((v) => v.id !== existingVote.id) }));
    } else {
      set((state) => ({
        votes: [...state.votes, {
          id: optimisticVoteId,
          card_id: cardId,
          board_id: board.id,
          voter_id: currentParticipantId,
          created_at: new Date().toISOString(),
        }],
      }));
    }

    const res = await fetch(`/api/boards/${board.id}/votes`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ cardId, voterId: currentParticipantId, voteId: optimisticVoteId }),
    });

    const data = await res.clone().json().catch(() => null);

    if (!res.ok) {
      // Revert optimistic update on failure
      if (existingVote) {
        set((state) => ({ votes: [...state.votes, existingVote] }));
      } else {
        set((state) => ({ votes: state.votes.filter((v) => v.id !== optimisticVoteId) }));
      }
      throw await failWrite(res, 'Failed to toggle vote');
    }

    // Client and server use the same vote ID, so nothing to replace. Under secret
    // voting no vote event is ever published, so the HTTP response is the only
    // confirmation: make local state match what the server actually did.
    set((state) => {
      if (data?.action === 'removed') {
        return {
          votes: state.votes.filter((v) => !(v.card_id === cardId && v.voter_id === currentParticipantId)),
        };
      }
      if (data?.action === 'added' && data.vote && !state.votes.some((v) => v.id === data.vote.id)) {
        return { votes: [...state.votes, data.vote as Vote] };
      }
      return state;
    });
  },

  // --- Reactions ---

  toggleReaction: async (cardId, emoji) => {
    const { board, cards, currentParticipantId } = get();
    if (!board || !currentParticipantId) return;

    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    const reactions = { ...(card.reactions || {}) };
    const users = reactions[emoji] ? [...reactions[emoji]] : [];
    const idx = users.indexOf(currentParticipantId);
    if (idx >= 0) {
      users.splice(idx, 1);
      if (users.length === 0) delete reactions[emoji];
      else reactions[emoji] = users;
    } else {
      reactions[emoji] = [...users, currentParticipantId];
    }

    // Optimistic update
    set((state) => ({
      cards: state.cards.map((c) => c.id === cardId ? { ...c, reactions } : c),
    }));

    const res = await fetch(`/api/boards/${board.id}/cards`, {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify({ cardId, updates: { reactions } }),
    });

    if (!res.ok) {
      // Revert
      set((state) => ({
        cards: state.cards.map((c) => c.id === cardId ? { ...c, reactions: card.reactions } : c),
      }));
      await failWrite(res, 'Failed to update reaction');
    }
  },

  // --- Action Items ---

  addActionItem: async (description, assignee, dueDate) => {
    const { board, currentParticipantId } = get();
    if (!board) return;

    // For action items, the server generates the UUID, so we can't do a true
    // optimistic add with dedup. Instead, don't add locally — let the Ably
    // event handle it. This avoids duplication.
    const res = await fetch(`/api/boards/${board.id}/action-items`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        description,
        assignee: assignee || null,
        dueDate: dueDate || null,
        createdBy: currentParticipantId,
      }),
    });

    if (!res.ok) {
      throw await failWrite(res, 'Failed to add action item');
    }
    // Don't add to state — Ably 'action-item-created' event will do it
  },

  updateActionItem: async (itemId, updates) => {
    const { board, actionItems } = get();
    if (!board) return;

    const prev = actionItems.find((a) => a.id === itemId);

    // Optimistic update
    set((state) => ({
      actionItems: state.actionItems.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item
      ),
    }));

    const res = await fetch(`/api/boards/${board.id}/action-items`, {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify({ itemId, updates }),
    });

    if (!res.ok) {
      if (prev) set((state) => ({ actionItems: state.actionItems.map((a) => (a.id === itemId ? prev : a)) }));
      throw await failWrite(res, 'Failed to update action item');
    }
  },

  deleteActionItem: async (itemId) => {
    const { board, actionItems } = get();
    if (!board) return;

    const prev = actionItems.find((a) => a.id === itemId);

    // Optimistic delete
    set((state) => ({
      actionItems: state.actionItems.filter((item) => item.id !== itemId),
    }));

    const res = await fetch(`/api/boards/${board.id}/action-items`, {
      method: 'DELETE',
      headers: JSON_HEADERS,
      body: JSON.stringify({ itemId }),
    });

    if (!res.ok) {
      if (prev) set((state) => ({ actionItems: [...state.actionItems, prev] }));
      throw await failWrite(res, 'Failed to delete action item');
    }
  },

  // --- Presence ---

  setOnlineParticipantIds: (ids) => set({ onlineParticipantIds: ids }),

  clearWriteError: () => set({ lastWriteError: null }),

  reset: () => {
    autoJoinTried.clear();
    set({ ...initialState, connectionStatus: 'connected', onlineParticipantIds: [] });
  },
}));
