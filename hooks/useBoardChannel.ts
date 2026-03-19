'use client';

import { useChannel } from 'ably/react';
import { useBoardStore } from '@/stores/boardStore';
import type { Card, Column, Vote, Participant, ActionItem } from '@/types';

export function useBoardChannel(boardId: string) {
  const store = useBoardStore;

  useChannel({ channelName: `retro-board:${boardId}` }, (message) => {
    const { name, data } = message;

    switch (name) {
      // Cards
      case 'card-created':
        store.setState((state) => {
          if (state.cards.some((c) => c.id === data.card.id)) return state;
          return { cards: [...state.cards, data.card as Card] };
        });
        break;
      case 'card-updated':
        store.setState((state) => ({
          cards: state.cards.map((c) => c.id === data.card.id ? (data.card as Card) : c),
        }));
        break;
      case 'card-deleted':
        store.setState((state) => ({
          cards: state.cards.filter((c) => c.id !== data.cardId),
          votes: state.votes.filter((v) => v.card_id !== data.cardId),
        }));
        break;

      // Columns
      case 'column-created':
        store.setState((state) => {
          if (state.columns.some((c) => c.id === data.column.id)) return state;
          return { columns: [...state.columns, data.column as Column] };
        });
        break;
      case 'column-updated':
        store.setState((state) => ({
          columns: state.columns.map((c) => c.id === data.column.id ? (data.column as Column) : c),
        }));
        break;
      case 'column-deleted':
        store.setState((state) => ({
          columns: state.columns.filter((c) => c.id !== data.columnId),
          cards: state.cards.filter((c) => c.column_id !== data.columnId),
        }));
        break;

      // Votes
      case 'vote-cast':
        store.setState((state) => {
          if (state.votes.some((v) => v.id === data.vote.id)) return state;
          return { votes: [...state.votes, data.vote as Vote] };
        });
        break;
      case 'vote-removed':
        store.setState((state) => ({
          votes: state.votes.filter((v) => v.id !== data.voteId),
        }));
        break;

      // Participants
      case 'participant-joined':
        store.setState((state) => {
          if (state.participants.some((p) => p.id === data.participant.id)) return state;
          return { participants: [...state.participants, data.participant as Participant] };
        });
        break;
      case 'participant-updated':
        store.setState((state) => ({
          participants: state.participants.map((p) =>
            p.id === data.participant.id ? (data.participant as Participant) : p
          ),
        }));
        break;
      case 'participant-removed':
        store.setState((state) => ({
          participants: state.participants.filter((p) => p.id !== data.participantId),
        }));
        break;

      // Board state
      case 'board-updated':
        store.setState((state) => ({
          board: state.board ? { ...state.board, settings: data.settings } : null,
        }));
        break;
      case 'board-completed':
        store.setState((state) => ({
          board: state.board
            ? { ...state.board, archived_at: data.archivedAt, settings: data.settings }
            : null,
        }));
        break;

      // Action Items
      case 'action-item-created':
        store.setState((state) => {
          if (state.actionItems.some((a) => a.id === data.item.id)) return state;
          return { actionItems: [...state.actionItems, data.item as ActionItem] };
        });
        break;
      case 'action-item-updated':
        store.setState((state) => ({
          actionItems: state.actionItems.map((a) =>
            a.id === data.item.id ? (data.item as ActionItem) : a
          ),
        }));
        break;
      case 'action-item-deleted':
        store.setState((state) => ({
          actionItems: state.actionItems.filter((a) => a.id !== data.itemId),
        }));
        break;
    }
  });
}
