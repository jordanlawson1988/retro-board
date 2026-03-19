'use client';

import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { DEFAULT_BOARD_SETTINGS } from '@/utils/constants';
import { BOARD_TEMPLATES } from '@/utils/templates';
import { saveBoardToHistory } from '@/utils/boardHistory';
import { useAppSettingsStore } from '@/stores/appSettingsStore';
import type { Board, Column, Card, Vote, ActionItem, Participant, BoardTemplate, BoardSettings, ConnectionStatus } from '@/types';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

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

  // Board lifecycle
  createBoard: (title: string, description: string | null, template: BoardTemplate, displayName?: string) => Promise<string>;
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
  updateColumn: (columnId: string, updates: Partial<Pick<Column, 'title' | 'color' | 'description'>>) => Promise<void>;
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
  onlineParticipantIds: [] as string[],
};

export const useBoardStore = create<BoardState>((set, get) => ({
  ...initialState,

  createBoard: async (title, description, template, displayName?) => {
    const boardId = nanoid(10);
    const templateDef = BOARD_TEMPLATES.find((t) => t.id === template);

    const participantId = crypto.randomUUID();

    const columns = templateDef && templateDef.columns.length > 0
      ? templateDef.columns.map((col, i) => ({
          id: nanoid(10),
          title: col.title,
          description: col.description || null,
          color: col.color,
          position: i,
        }))
      : [];

    const participant = displayName
      ? { id: participantId, displayName, isAdmin: true }
      : undefined;

    const res = await fetch('/api/boards', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        id: boardId,
        title,
        description,
        template,
        createdBy: participantId,
        settings: {
          ...DEFAULT_BOARD_SETTINGS,
          ...(useAppSettingsStore?.getState?.()?.settings?.default_board_settings ?? {}),
        },
        columns,
        participant,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create board');
    }

    // Update local state for auto-joined creator
    if (displayName) {
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

    const res = await fetch(`/api/boards/${boardId}`);

    if (!res.ok) {
      const err = await res.json();
      set({ loading: false, error: err.error || 'Board not found' });
      return;
    }

    const { board, columns, cards, votes, actionItems, participants } = await res.json();

    const stored = localStorage.getItem(`retro-pid-${boardId}`);

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
      currentParticipantId: stored || null,
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
      body: JSON.stringify({ settings: newSettings }),
    });

    if (!res.ok) {
      set({ board: { ...board, settings: prevSettings } });
      const err = await res.json();
      throw new Error(err.error || 'Failed to update settings');
    }
  },

  completeBoard: async () => {
    const { board } = get();
    if (!board) return;

    const archivedAt = new Date().toISOString();
    const completedSettings = { ...board.settings, card_visibility: 'visible' as const, board_locked: true };

    // Optimistic update
    set({ board: { ...board, archived_at: archivedAt, settings: completedSettings } });

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
      const err = await res.json();
      throw new Error(err.error || 'Failed to complete board');
    }
  },

  joinBoard: async (boardId, displayName) => {
    // Check if already joined (e.g., creator who auto-joined in createBoard)
    const stored = localStorage.getItem(`retro-pid-${boardId}`);
    if (stored) {
      const { participants } = get();
      const existing = participants.find((p) => p.id === stored);
      if (existing) {
        set({ currentParticipantId: stored });
        return;
      }
    }

    const participantId = crypto.randomUUID();

    // First joiner (no existing admins) becomes the facilitator
    const { participants: currentParticipants } = get();
    const hasAdmin = currentParticipants.some((p) => p.is_admin);
    const isAdmin = !hasAdmin;

    const res = await fetch(`/api/boards/${boardId}/join`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ participantId, displayName, isAdmin }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to join board');
    }

    localStorage.setItem(`retro-pid-${boardId}`, participantId);

    const newParticipant: Participant = {
      id: participantId,
      board_id: boardId,
      display_name: displayName,
      is_admin: isAdmin,
      joined_at: new Date().toISOString(),
      last_seen: new Date().toISOString(),
    };

    set((state) => ({
      currentParticipantId: participantId,
      board: isAdmin && state.board ? { ...state.board, created_by: participantId } : state.board,
      participants: [...state.participants, newParticipant],
    }));
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
      const err = await res.json();
      throw new Error(err.error || 'Failed to update participant');
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
      const err = await res.json();
      throw new Error(err.error || 'Failed to remove participant');
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
    const optimisticCol: Column = { ...newCol, board_id: board.id, created_at: new Date().toISOString() };
    set((state) => ({ columns: [...state.columns, optimisticCol] }));

    const res = await fetch(`/api/boards/${board.id}/columns`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(newCol),
    });

    if (!res.ok) {
      // Revert on failure
      set((state) => ({ columns: state.columns.filter((c) => c.id !== newCol.id) }));
      const err = await res.json();
      throw new Error(err.error || 'Failed to add column');
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
      const err = await res.json();
      throw new Error(err.error || 'Failed to update column');
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
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete column');
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
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
      const err = await res.json();
      throw new Error(err.error || 'Failed to add card');
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
      const err = await res.json();
      throw new Error(err.error || 'Failed to update card');
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
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete card');
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
      const err = await res.json();
      throw new Error(err.error || 'Failed to move card');
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
      const err = await res.json();
      throw new Error(err.error || 'Failed to combine cards');
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
      const err = await res.json();
      throw new Error(err.error || 'Failed to uncombine card');
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
      body: JSON.stringify({ cardId, voterId: currentParticipantId }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      // Revert optimistic update on failure
      if (existingVote) {
        set((state) => ({ votes: [...state.votes, existingVote] }));
      } else {
        set((state) => ({ votes: state.votes.filter((v) => v.id !== optimisticVoteId) }));
      }
      throw new Error(data?.error || 'Failed to toggle vote');
    }

    // If we added a vote, update with the server-generated ID
    if (!existingVote && data?.vote?.id && data.vote.id !== optimisticVoteId) {
      set((state) => ({
        votes: state.votes.map((v) =>
          v.id === optimisticVoteId ? { ...v, id: data.vote.id } : v
        ),
      }));
    }
  },

  // --- Action Items ---

  addActionItem: async (description, assignee, dueDate) => {
    const { board } = get();
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
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to add action item');
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
      const err = await res.json();
      throw new Error(err.error || 'Failed to update action item');
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
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete action item');
    }
  },

  // --- Presence ---

  setOnlineParticipantIds: (ids) => set({ onlineParticipantIds: ids }),

  reset: () => set({ ...initialState, connectionStatus: 'connected', onlineParticipantIds: [] }),
}));
