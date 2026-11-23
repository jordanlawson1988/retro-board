import { create } from 'zustand';
import { useBoardStore, failWrite, refetchBoardCoalesced } from '@/stores/boardStore';
import { failAction, noAnswer } from '@/stores/failAction';
import { NETWORK_ERROR } from '@/stores/phaseStore';
import { GUIDED_MODE } from '@/lib/constants/phases';
import { validateGroupTitle, ungroupAll, SET_TITLE_FALLBACK, RESET_GROUPING_FALLBACK } from '@/lib/groups';
import {
  ADD_VOTE_FALLBACK, REMOVE_VOTE_FALLBACK, EMPTY_VOTE_SLOT, applyVoteDelta, applyVoteTally, finishVoteClick,
  groupRemoveTarget, maxVotesPerCard, myGroupVotesOn, settleOwnVote, startVoteClick, voteControlState, voteResult, votesUsedBy,
  type VoteSlot,
} from '@/lib/votes';
import { bumpTallyVersion } from '@/lib/voteTallyVersion';
import type { Board, Vote } from '@/types';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

interface GroupVoteState {
  resetting: boolean;
  addVote: (cardId: string) => Promise<void>;
  removeVote: (cardId: string) => Promise<void>;
  toggleGuidedVote: (cardId: string) => Promise<void>;
  setGroupTitle: (cardId: string, title: string | null) => Promise<void>;
  resetGrouping: () => Promise<void>;
}

/** Clicks in flight per `${boardId}:${cardId}`, and the newest answer for each. */
const slots = new Map<string, VoteSlot>();

/** The board the store is on right now, when it is a guided one. */
function guidedBoard(): Board | null {
  const { board } = useBoardStore.getState();
  return board && board.mode === GUIDED_MODE ? board : null;
}

const onBoard = (boardId: string) => useBoardStore.getState().board?.id === boardId;

async function castVote(cardId: string, action: 'add' | 'remove'): Promise<void> {
  const { board, currentParticipantId: voterId, votes, cards } = useBoardStore.getState();
  if (!board || board.mode !== GUIDED_MODE || !voterId) return;
  const boardId = board.id;
  // The card whose row this click changes: the clicked card for an add; for a remove the row the
  // server will take from (my row on the card, else my earliest child row).
  const rowCardId = action === 'add' ? cardId : groupRemoveTarget(votes, cards, cardId, voterId);
  if (rowCardId === null) return;
  const mine = votes.find((v) => v.card_id === rowCardId && v.voter_id === voterId);
  const voteId = mine?.id ?? crypto.randomUUID();
  const delta = action === 'add' ? 1 : -1;
  const fallback = action === 'add' ? ADD_VOTE_FALLBACK : REMOVE_VOTE_FALLBACK;
  const key = `${boardId}:${cardId}`;
  const myCount = () => {
    const st = useBoardStore.getState();
    return myGroupVotesOn(st.votes, st.cards, cardId, voterId);
  };

  useBoardStore.setState((s) => ({
    votes: applyVoteDelta(s.votes, { boardId, cardId: rowCardId, voterId, voteId, delta, nowIso: new Date().toISOString() }),
  }));
  slots.set(key, startVoteClick(slots.get(key) ?? EMPTY_VOTE_SLOT, myCount()));

  // Close this click. A failed click's delta comes off only when the row still holds the count the
  // burst expects; when the last click of the burst finishes the newest answer settles the row and
  // a burst with a failure pulls the server's truth. Nothing touches a board the user has left.
  // Returns whether the caller must refetch.
  const finish = (outcome: { kind: 'ok'; at: number; vote: Vote | null; otherRow: boolean } | { kind: 'failed'; refetched: boolean }): boolean => {
    const current = onBoard(boardId);
    const done = finishVoteClick(
      slots.get(key) ?? EMPTY_VOTE_SLOT,
      outcome.kind === 'ok' ? outcome : { ...outcome, delta, currentCount: current ? myCount() : -1 },
    );
    if (done.slot.pending === 0) slots.delete(key);
    else slots.set(key, done.slot);
    if (!current) return false;
    useBoardStore.setState((s) => {
      let next = s.votes;
      if (done.reverse) {
        next = applyVoteDelta(next, { boardId, cardId: rowCardId, voterId, voteId, delta: delta === 1 ? -1 : 1, nowIso: new Date().toISOString() });
      }
      if (done.settle) next = settleOwnVote(next, { cardId: rowCardId, voterId, vote: done.settle.vote });
      return { votes: next };
    });
    return done.refetch;
  };

  const fail = async (res: Response | null, message: string): Promise<never> => {
    const refetchedByFailWrite = res?.status === 409;
    const needsRefetch = finish({ kind: 'failed', refetched: refetchedByFailWrite });
    const err = await failAction(res, message, boardId, { refetch: false });
    if (needsRefetch && onBoard(boardId)) await refetchBoardCoalesced(boardId); // never rejects
    throw err;
  };

  let res: Response;
  try {
    res = await fetch(`/api/boards/${boardId}/votes`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(action === 'add' ? { cardId, action, voteId } : { cardId, action }),
    });
  } catch {
    return fail(null, NETWORK_ERROR);
  }

  if (!res.ok) return fail(res, fallback);

  const result = voteResult(await res.json().catch(() => null), useBoardStore.getState().votes.find((v) => v.card_id === rowCardId && v.voter_id === voterId), {
    boardId, cardId, voterId, nowIso: new Date().toISOString(),
  });
  // A 200 in a shape we do not understand leaves the server's state unknown: treat it as a failure.
  if (!result) return fail(noAnswer(), fallback);

  if (onBoard(boardId)) {
    bumpTallyVersion();
    useBoardStore.setState((s) => ({ voteTally: applyVoteTally(s.voteTally, result.tally) }));
  }
  // Also true when the server took from a different row than the one changed optimistically (a race).
  const otherRow = result.cardId !== cardId || result.cardId !== rowCardId;
  const needsRefetch = finish({ kind: 'ok', at: result.tally.at, vote: result.vote, otherRow });
  if (needsRefetch && onBoard(boardId)) await refetchBoardCoalesced(boardId);
}

/** A `vote-tally` event for this board: newer wins, and a GET already in flight must not undo it. */
export function applyVoteTallyEvent(boardId: string, data: unknown): void {
  if (!onBoard(boardId)) return;
  bumpTallyVersion();
  useBoardStore.setState((s) => ({ voteTally: applyVoteTally(s.voteTally, data) }));
}

export const useGroupVoteStore = create<GroupVoteState>((set, get) => ({
  resetting: false,

  addVote: async (cardId) => {
    const { board, currentParticipantId: voterId, votes, cards } = useBoardStore.getState();
    if (!board || board.mode !== GUIDED_MODE || !voterId) return;
    const control = voteControlState({
      onCard: myGroupVotesOn(votes, cards, cardId, voterId),
      spent: votesUsedBy(votes, voterId),
      perCard: maxVotesPerCard(board.settings),
      perPerson: board.settings.max_votes_per_participant,
      childCard: cards.find((c) => c.id === cardId)?.merged_with != null,
    });
    if (!control.canAdd) return;
    await castVote(cardId, 'add');
  },

  removeVote: async (cardId) => {
    const { board, currentParticipantId: voterId, votes, cards } = useBoardStore.getState();
    if (!board || board.mode !== GUIDED_MODE || !voterId) return;
    if (groupRemoveTarget(votes, cards, cardId, voterId) === null) return;
    await castVote(cardId, 'remove');
  },

  toggleGuidedVote: async (cardId) => {
    const { currentParticipantId: voterId, votes, cards } = useBoardStore.getState();
    if (myGroupVotesOn(votes, cards, cardId, voterId) > 0) await get().removeVote(cardId);
    else await get().addVote(cardId);
  },

  setGroupTitle: async (cardId, title) => {
    const board = guidedBoard();
    if (!board) return;
    const boardId = board.id;
    const checked = validateGroupTitle(title);
    if (!checked.ok) {
      throw await failWrite(json400(checked.error), SET_TITLE_FALLBACK);
    }
    const card = useBoardStore.getState().cards.find((c) => c.id === cardId);
    if (!card) return;
    const previous = card.group_title ?? null;
    const optimistic = checked.value;

    const setTitleOn = (value: string | null) =>
      useBoardStore.setState((s) => ({
        cards: s.cards.map((c) => (c.id === cardId ? { ...c, group_title: value } : c)),
      }));
    setTitleOn(optimistic);

    const revert = () => {
      if (!onBoard(boardId)) return;
      const now = useBoardStore.getState().cards.find((c) => c.id === cardId);
      if (now && (now.group_title ?? null) === optimistic) setTitleOn(previous);
    };

    let res: Response;
    try {
      res = await fetch(`/api/boards/${boardId}/groups`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ action: 'set-title', cardId, title: optimistic }),
      });
    } catch {
      revert();
      throw await failAction(null, NETWORK_ERROR, boardId);
    }
    if (!res.ok) {
      revert();
      throw await failAction(res, SET_TITLE_FALLBACK, boardId);
    }
  },

  resetGrouping: async () => {
    if (get().resetting) return;
    const board = guidedBoard();
    if (!board) return;
    const boardId = board.id;
    set({ resetting: true });
    try {
      let res: Response;
      try {
        res = await fetch(`/api/boards/${boardId}/groups`, {
          method: 'POST',
          headers: JSON_HEADERS,
          body: JSON.stringify({ action: 'reset' }),
        });
      } catch {
        throw await failAction(null, NETWORK_ERROR, boardId);
      }
      if (!res.ok) throw await failAction(res, RESET_GROUPING_FALLBACK, boardId);
      if (onBoard(boardId)) useBoardStore.setState((s) => ({ cards: ungroupAll(s.cards) }));
    } finally {
      set({ resetting: false });
    }
  },
}));

function json400(error: string): Response {
  return new Response(JSON.stringify({ error }), { status: 400, headers: JSON_HEADERS });
}
