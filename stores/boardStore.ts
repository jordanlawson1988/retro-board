'use client';

import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { supabase } from '@/lib/supabase';
import { DEFAULT_BOARD_SETTINGS } from '@/utils/constants';
import { BOARD_TEMPLATES } from '@/utils/templates';
import { saveBoardToHistory } from '@/utils/boardHistory';
import { useAppSettingsStore } from '@/stores/appSettingsStore';
import type { Board, Column, Card, Vote, ActionItem, Participant, BoardTemplate, BoardSettings, ConnectionStatus } from '@/types';

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

  // Realtime
  subscribeToBoard: (boardId: string) => () => void;
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

    const { error: boardError } = await supabase.from('boards').insert({
      id: boardId,
      title,
      description,
      template,
      created_by: participantId,
      settings: {
        ...DEFAULT_BOARD_SETTINGS,
        ...(useAppSettingsStore?.getState?.()?.settings?.default_board_settings ?? {}),
      },
    });

    if (boardError) throw boardError;

    if (templateDef && templateDef.columns.length > 0) {
      const columnsToInsert = templateDef.columns.map((col, i) => ({
        id: nanoid(10),
        board_id: boardId,
        title: col.title,
        description: col.description || null,
        color: col.color,
        position: i,
      }));

      const { error: colError } = await supabase.from('columns').insert(columnsToInsert);
      if (colError) throw colError;
    }

    // Auto-join creator as admin
    if (displayName) {
      const { error: joinError } = await supabase.from('participants').insert({
        id: participantId,
        board_id: boardId,
        display_name: displayName,
        is_admin: true,
      });
      if (joinError) throw joinError;

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

    const { data: board, error: boardError } = await supabase
      .from('boards')
      .select('*')
      .eq('id', boardId)
      .single();

    if (boardError) {
      set({ loading: false, error: boardError.message });
      return;
    }

    const [columnsRes, cardsRes, votesRes, actionItemsRes, participantsRes] = await Promise.all([
      supabase.from('columns').select('*').eq('board_id', boardId).order('position'),
      supabase.from('cards').select('*').eq('board_id', boardId).order('position'),
      supabase.from('votes').select('*').eq('board_id', boardId),
      supabase.from('action_items').select('*').eq('board_id', boardId).order('created_at'),
      supabase.from('participants').select('*').eq('board_id', boardId),
    ]);

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
      columns: columnsRes.data || [],
      cards: cardsRes.data || [],
      votes: votesRes.data || [],
      actionItems: actionItemsRes.data || [],
      participants: participantsRes.data || [],
      currentParticipantId: stored || null,
      loading: false,
    });
  },

  updateSettings: async (settingsUpdate) => {
    const { board } = get();
    if (!board) return;

    const newSettings = { ...board.settings, ...settingsUpdate };

    const { error } = await supabase
      .from('boards')
      .update({ settings: newSettings })
      .eq('id', board.id);

    if (error) throw error;

    set({ board: { ...board, settings: newSettings } });
  },

  completeBoard: async () => {
    const { board } = get();
    if (!board) return;

    const archivedAt = new Date().toISOString();
    const { error } = await supabase
      .from('boards')
      .update({
        archived_at: archivedAt,
        settings: { ...board.settings, card_visibility: 'visible', board_locked: true },
      })
      .eq('id', board.id);

    if (error) throw error;

    set({
      board: {
        ...board,
        archived_at: archivedAt,
        settings: { ...board.settings, card_visibility: 'visible' as const, board_locked: true },
      },
    });

    saveBoardToHistory({
      boardId: board.id,
      title: board.title,
      createdAt: board.created_at,
      lastVisited: new Date().toISOString(),
      isCompleted: true,
    });
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

    const { error } = await supabase.from('participants').insert({
      id: participantId,
      board_id: boardId,
      display_name: displayName,
      is_admin: isAdmin,
    });

    if (error) throw error;

    // If this is the first joiner, also set them as board creator
    if (isAdmin) {
      await supabase.from('boards').update({ created_by: participantId }).eq('id', boardId);
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
    const { error } = await supabase
      .from('participants')
      .update(updates)
      .eq('id', participantId);
    if (error) throw error;
    set((state) => ({
      participants: state.participants.map((p) =>
        p.id === participantId ? { ...p, ...updates } : p
      ),
    }));
  },

  removeParticipant: async (participantId) => {
    const { error } = await supabase
      .from('participants')
      .delete()
      .eq('id', participantId);
    if (error) throw error;
    set((state) => ({
      participants: state.participants.filter((p) => p.id !== participantId),
    }));
  },

  // --- Column CRUD ---

  addColumn: async (title, color, description) => {
    const { board, columns } = get();
    if (!board) return;

    const newCol = {
      id: nanoid(10),
      board_id: board.id,
      title,
      description: description || null,
      color,
      position: columns.length,
    };

    const { error } = await supabase.from('columns').insert(newCol);
    if (error) throw error;

    set((state) => ({
      columns: [...state.columns, { ...newCol, created_at: new Date().toISOString() }],
    }));
  },

  updateColumn: async (columnId, updates) => {
    const { error } = await supabase.from('columns').update(updates).eq('id', columnId);
    if (error) throw error;

    set((state) => ({
      columns: state.columns.map((c) => (c.id === columnId ? { ...c, ...updates } : c)),
    }));
  },

  deleteColumn: async (columnId) => {
    const { error } = await supabase.from('columns').delete().eq('id', columnId);
    if (error) throw error;

    set((state) => ({
      columns: state.columns.filter((c) => c.id !== columnId),
      cards: state.cards.filter((c) => c.column_id !== columnId),
    }));
  },

  // --- Card CRUD ---

  addCard: async (columnId, text) => {
    const { board, cards, currentParticipantId, participants } = get();
    if (!board || !currentParticipantId) return;

    const participant = participants.find((p) => p.id === currentParticipantId);
    const cardsInColumn = cards.filter((c) => c.column_id === columnId);

    const newCard = {
      id: nanoid(10),
      column_id: columnId,
      board_id: board.id,
      text,
      author_name: participant?.display_name || 'Anonymous',
      author_id: currentParticipantId,
      color: null,
      position: cardsInColumn.length,
      merged_with: null,
    };

    const { error } = await supabase.from('cards').insert(newCard);
    if (error) throw error;

    const fullCard = { ...newCard, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    set((state) => ({ cards: [...state.cards, fullCard] }));
  },

  updateCard: async (cardId, updates) => {
    const { error } = await supabase.from('cards').update(updates).eq('id', cardId);
    if (error) throw error;

    const updatedAt = new Date().toISOString();
    set((state) => ({
      cards: state.cards.map((c) =>
        c.id === cardId ? { ...c, ...updates, updated_at: updatedAt } : c
      ),
    }));
  },

  deleteCard: async (cardId) => {
    const { error } = await supabase.from('cards').delete().eq('id', cardId);
    if (error) throw error;

    // DB ON DELETE SET NULL auto-clears merged_with on children;
    // mirror that optimistically so children don't become invisible ghost cards
    set((state) => ({
      cards: state.cards
        .filter((c) => c.id !== cardId)
        .map((c) => c.merged_with === cardId ? { ...c, merged_with: null } : c),
      votes: state.votes.filter((v) => v.card_id !== cardId),
    }));
  },

  moveCard: async (cardId, targetColumnId, newPosition) => {
    const { cards } = get();
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

    const { error } = await supabase
      .from('cards')
      .update({ column_id: targetColumnId, position: newPosition })
      .eq('id', cardId);

    if (error) {
      // Revert on failure
      set((state) => ({
        cards: state.cards.map((c) => {
          if (c.id === cardId) return { ...c, column_id: card.column_id, position: card.position };
          if (childIds.includes(c.id)) return { ...c, column_id: card.column_id };
          return c;
        }),
      }));
      throw error;
    }

    // Move children in DB too
    if (childIds.length > 0) {
      await supabase
        .from('cards')
        .update({ column_id: targetColumnId })
        .in('id', childIds);
    }
  },

  combineCards: async (parentCardId, childCardId) => {
    const { cards } = get();
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
    const { error } = await supabase
      .from('cards')
      .update({ merged_with: parentCardId, column_id: parent.column_id })
      .eq('id', childCardId);

    if (error) {
      // Revert
      set((state) => ({
        cards: state.cards.map((c) =>
          c.id === childCardId ? { ...c, merged_with: child.merged_with, column_id: child.column_id } : c
        ),
      }));
      throw error;
    }

    // Re-parent grandchildren
    if (grandchildren.length > 0) {
      const gcIds = grandchildren.map((c) => c.id);
      await supabase
        .from('cards')
        .update({ merged_with: parentCardId, column_id: parent.column_id })
        .in('id', gcIds);
    }
  },

  uncombineCard: async (childCardId) => {
    const { cards } = get();
    const child = cards.find((c) => c.id === childCardId);
    if (!child || !child.merged_with) return;

    const prevMergedWith = child.merged_with;

    // Optimistic update
    set((state) => ({
      cards: state.cards.map((c) =>
        c.id === childCardId ? { ...c, merged_with: null } : c
      ),
    }));

    const { error } = await supabase
      .from('cards')
      .update({ merged_with: null })
      .eq('id', childCardId);

    if (error) {
      set((state) => ({
        cards: state.cards.map((c) =>
          c.id === childCardId ? { ...c, merged_with: prevMergedWith } : c
        ),
      }));
      throw error;
    }
  },

  // --- Voting ---

  toggleVote: async (cardId) => {
    const { board, votes, currentParticipantId } = get();
    if (!board || !currentParticipantId) return;

    const existingVote = votes.find(
      (v) => v.card_id === cardId && v.voter_id === currentParticipantId
    );

    if (existingVote) {
      const { error } = await supabase.from('votes').delete().eq('id', existingVote.id);
      if (error) throw error;
      set((state) => ({ votes: state.votes.filter((v) => v.id !== existingVote.id) }));
    } else {
      // Check global vote limit
      const myVoteCount = votes.filter((v) => v.voter_id === currentParticipantId).length;
      if (myVoteCount >= board.settings.max_votes_per_participant) return;

      // Add vote (DB UNIQUE constraint enforces one-per-card)
      const newVote = {
        id: crypto.randomUUID(),
        card_id: cardId,
        board_id: board.id,
        voter_id: currentParticipantId,
      };

      const { error } = await supabase.from('votes').insert(newVote);
      if (error) throw error;

      set((state) => ({
        votes: [...state.votes, { ...newVote, created_at: new Date().toISOString() }],
      }));
    }
  },

  // --- Action Items ---

  addActionItem: async (description, assignee, dueDate) => {
    const { board } = get();
    if (!board) return;

    const newItem = {
      board_id: board.id,
      description,
      assignee: assignee || null,
      due_date: dueDate || null,
      status: 'open' as const,
    };

    const { data, error } = await supabase.from('action_items').insert(newItem).select().single();
    if (error) throw error;

    set((state) => ({
      actionItems: [...state.actionItems, data as ActionItem],
    }));
  },

  updateActionItem: async (itemId, updates) => {
    const { error } = await supabase.from('action_items').update(updates).eq('id', itemId);
    if (error) throw error;

    set((state) => ({
      actionItems: state.actionItems.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item
      ),
    }));
  },

  deleteActionItem: async (itemId) => {
    const { error } = await supabase.from('action_items').delete().eq('id', itemId);
    if (error) throw error;

    set((state) => ({
      actionItems: state.actionItems.filter((item) => item.id !== itemId),
    }));
  },

  // --- Presence ---

  setOnlineParticipantIds: (ids) => set({ onlineParticipantIds: ids }),

  // --- Realtime ---

  subscribeToBoard: (boardId) => {
    let hasSubscribed = false;
    let wasDisconnected = false;

    const channel = supabase
      .channel(`board:${boardId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'cards', filter: `board_id=eq.${boardId}` },
        (payload) => {
          set((state) => {
            if (state.cards.some((c) => c.id === payload.new.id)) return state;
            return { cards: [...state.cards, payload.new as Card] };
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'cards', filter: `board_id=eq.${boardId}` },
        (payload) => {
          set((state) => ({
            cards: state.cards.map((c) => (c.id === payload.new.id ? (payload.new as Card) : c)),
          }));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'cards', filter: `board_id=eq.${boardId}` },
        (payload) => {
          set((state) => ({
            cards: state.cards.filter((c) => c.id !== payload.old.id),
            votes: state.votes.filter((v) => v.card_id !== payload.old.id),
          }));
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'columns', filter: `board_id=eq.${boardId}` },
        (payload) => {
          set((state) => {
            if (state.columns.some((c) => c.id === payload.new.id)) return state;
            return { columns: [...state.columns, payload.new as Column] };
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'columns', filter: `board_id=eq.${boardId}` },
        (payload) => {
          set((state) => ({
            columns: state.columns.map((c) => (c.id === payload.new.id ? (payload.new as Column) : c)),
          }));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'columns', filter: `board_id=eq.${boardId}` },
        (payload) => {
          set((state) => {
            const deletedColumnId = payload.old.id;
            const deletedCardIds = new Set(
              state.cards.filter((c) => c.column_id === deletedColumnId).map((c) => c.id)
            );
            return {
              columns: state.columns.filter((c) => c.id !== deletedColumnId),
              cards: state.cards.filter((c) => c.column_id !== deletedColumnId),
              votes: state.votes.filter((v) => !deletedCardIds.has(v.card_id)),
            };
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'votes', filter: `board_id=eq.${boardId}` },
        (payload) => {
          set((state) => {
            if (state.votes.some((v) => v.id === payload.new.id)) return state;
            return { votes: [...state.votes, payload.new as Vote] };
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'votes', filter: `board_id=eq.${boardId}` },
        (payload) => {
          set((state) => ({
            votes: state.votes.filter((v) => v.id !== payload.old.id),
          }));
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'participants', filter: `board_id=eq.${boardId}` },
        (payload) => {
          set((state) => {
            if (state.participants.some((p) => p.id === payload.new.id)) return state;
            return { participants: [...state.participants, payload.new as Participant] };
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'participants', filter: `board_id=eq.${boardId}` },
        (payload) => {
          set((state) => ({
            participants: state.participants.map((p) =>
              p.id === payload.new.id ? { ...payload.new as Participant } : p
            ),
          }));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'participants', filter: `board_id=eq.${boardId}` },
        (payload) => {
          set((state) => ({
            participants: state.participants.filter((p) => p.id !== payload.old.id),
          }));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'boards', filter: `id=eq.${boardId}` },
        (payload) => {
          set({ board: payload.new as Board });
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'action_items', filter: `board_id=eq.${boardId}` },
        (payload) => {
          set((state) => {
            if (state.actionItems.some((a) => a.id === payload.new.id)) return state;
            return { actionItems: [...state.actionItems, payload.new as ActionItem] };
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'action_items', filter: `board_id=eq.${boardId}` },
        (payload) => {
          set((state) => ({
            actionItems: state.actionItems.map((a) => (a.id === payload.new.id ? (payload.new as ActionItem) : a)),
          }));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'action_items', filter: `board_id=eq.${boardId}` },
        (payload) => {
          set((state) => ({
            actionItems: state.actionItems.filter((a) => a.id !== payload.old.id),
          }));
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          if (hasSubscribed && wasDisconnected) {
            console.log(`[Realtime] Board ${boardId}: reconnected — re-fetching data`);
            set({ connectionStatus: 'reconnected' });
            get().fetchBoard(boardId).then(() => {
              setTimeout(() => set({ connectionStatus: 'connected' }), 3000);
            });
          } else {
            set({ connectionStatus: 'connected' });
          }
          hasSubscribed = true;
          wasDisconnected = false;
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`[Realtime] Board ${boardId}: channel error`, err);
          wasDisconnected = true;
          set({ connectionStatus: 'disconnected' });
        } else if (status === 'TIMED_OUT') {
          console.error(`[Realtime] Board ${boardId}: subscription timed out`);
          wasDisconnected = true;
          set({ connectionStatus: 'disconnected' });
        } else if (status === 'CLOSED') {
          wasDisconnected = true;
          set({ connectionStatus: 'disconnected' });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  },

  reset: () => set({ ...initialState, connectionStatus: 'connected', onlineParticipantIds: [] }),
}));
