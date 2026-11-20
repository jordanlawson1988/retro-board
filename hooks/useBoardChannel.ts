'use client';

import { useEffect, useMemo } from 'react';
import { useAbly, useChannel } from 'ably/react';
import { useBoardStore, refetchBoardCoalesced } from '@/stores/boardStore';
import { mergeIncomingCard } from '@/lib/mergeIncomingCard';
import { applyPhaseChanged, phaseConfigAfterClose, refetchRouteFor } from '@/lib/phases';
import { isPhaseId } from '@/lib/constants/phases';
import type { Card, Column, Vote, Participant, ActionItem } from '@/types';

export function useBoardChannel(boardId: string) {
  const store = useBoardStore;

  // A reveal (or complete/reopen) changes what this viewer may see, but the event
  // itself carries nothing sensitive. Refetch the shaped board; fetchBoard replaces
  // cards and votes wholesale, so anything re-hidden is dropped too.
  const refetchIfAsked = (data: { refetch?: boolean } | undefined) => {
    if (data?.refetch === true) void store.getState().fetchBoard(boardId);
  };

  // Ably does not replay what was published before we attached, so anything between the
  // initial GET and the attach (or during a gap without continuity) is lost. Refetch the
  // server-shaped board then. Coalesced: one in flight, bursts collapse to one trailing run.
  // The same per-board runner serves the phase-changed refetch, so two guided refetches never race.
  const refetchBoard = useMemo(() => () => void refetchBoardCoalesced(boardId), [boardId]);

  // Complete and reopen on a guided board refetch through that same runner, so a GET that started
  // before the event cannot land last and leave phase and archived_at stale. Open boards keep
  // the direct refetch.
  const refetchCompletionEvent = (data: { refetch?: boolean; phase?: unknown } | undefined) => {
    if (refetchRouteFor(data) === 'coalesced') void refetchBoardCoalesced(boardId);
    else refetchIfAsked(data);
  };

  const ably = useAbly();

  const { channel } = useChannel({ channelName: `retro-board:${boardId}` }, (message) => {
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
        // Ably cards are shaped for nobody; keep our own text/author (see mergeIncomingCard).
        store.setState((state) => ({
          cards: state.cards.map((c) => c.id === data.card.id ? mergeIncomingCard(c, data.card as Card) : c),
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
          board: state.board
            ? {
                ...state.board,
                ...(data.title !== undefined ? { title: data.title } : {}),
                ...(data.description !== undefined ? { description: data.description } : {}),
                ...(data.settings !== undefined ? { settings: data.settings } : {}),
              }
            : null,
        }));
        refetchIfAsked(data);
        break;
      case 'board-reopened':
        store.setState((state) => ({
          board: state.board
            ? { ...state.board, archived_at: null, settings: data.settings, ...(isPhaseId(data.phase) ? { phase: data.phase, phase_config: phaseConfigAfterClose(state.board.phase_config, data) } : {}) }
            : null,
        }));
        refetchCompletionEvent(data);
        break;
      case 'board-completed':
        store.setState((state) => ({
          board: state.board
            ? { ...state.board, archived_at: data.archivedAt, settings: data.settings, ...(isPhaseId(data.phase) ? { phase: data.phase, phase_config: phaseConfigAfterClose(state.board.phase_config, data) } : {}) }
            : null,
        }));
        refetchCompletionEvent(data);
        break;

      // Guided phase: idempotent, the same payload twice leaves the same board
      case 'phase-changed':
        store.setState((state) => ({
          board: state.board ? applyPhaseChanged(state.board, data) : null,
        }));
        if (data?.refetch === true) refetchBoard();
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
  useEffect(() => {
    // 'attached' fires on first attach; 'update' on an attached->attached change.
    // resumed === true means Ably guarantees no message was missed, so nothing to do.
    const onChange = (change: { resumed: boolean }) => {
      if (!change.resumed) refetchBoard();
    };
    channel.on('attached', onChange);
    channel.on('update', onChange);
    // Already attached before this effect ran: the initial GET may predate the attach.
    if (channel.state === 'attached') refetchBoard();

    const onConnection = (change: { previous: string; current: string }) => {
      if (change.current === 'connected' && (change.previous === 'suspended' || change.previous === 'failed')) {
        refetchBoard();
      }
    };
    ably.connection.on(onConnection);

    return () => {
      channel.off('attached', onChange);
      channel.off('update', onChange);
      ably.connection.off(onConnection);
    };
  }, [channel, ably, refetchBoard]);
}
