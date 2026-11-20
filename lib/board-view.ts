import type { BoardSettings, Card, Vote } from '@/types';

export interface Viewer {
  participantId: string | null;
}

export const PUBLIC_VIEWER: Viewer = { participantId: null };

export interface ViewBoard {
  trust_version: 1 | 2;
  settings: BoardSettings;
  archived_at: string | null;
}

/** True on a v2 board with secret voting on and not yet completed. */
export function votesAreSecret(board: ViewBoard): boolean {
  return board.trust_version === 2 && board.settings.secret_voting && !board.archived_at;
}

/** Decide what `viewer` may see of `card`. Pure; never mutates its input. */
export function shapeCard(card: Card, board: ViewBoard, viewer: Viewer): Card {
  const isMine =
    viewer.participantId !== null &&
    card.author_id !== null &&
    card.author_id === viewer.participantId;

  if (board.trust_version === 1) {
    return { ...card, is_mine: isMine, text_hidden: false };
  }

  const shaped: Card = { ...card, is_mine: isMine, text_hidden: false };

  if (board.settings.card_visibility === 'hidden' && !isMine && !board.archived_at) {
    shaped.text = '';
    shaped.text_hidden = true;
  }

  if (board.settings.anonymous_cards && !isMine) {
    shaped.author_id = null;
    shaped.author_name = null;
  }

  // Embedded vote data would defeat secret voting, so shape it like shapeVotes does.
  if (votesAreSecret(board)) {
    if (shaped.votes) {
      shaped.votes = shaped.votes.filter(
        (v) => viewer.participantId !== null && v.voter_id === viewer.participantId
      );
    }
    if (shaped.vote_count !== undefined) delete shaped.vote_count;
  }

  return shaped;
}

/** Decide which votes `viewer` may see. Secret voting shows only the viewer's own. */
export function shapeVotes(votes: Vote[], board: ViewBoard, viewer: Viewer): Vote[] {
  if (!votesAreSecret(board)) return votes;
  if (viewer.participantId === null) return [];
  return votes.filter((v) => v.voter_id === viewer.participantId);
}

/** True when a settings change shows something that was previously withheld. */
export function isRevealingChange(prev: BoardSettings, next: BoardSettings): boolean {
  return (
    (prev.card_visibility === 'hidden' && next.card_visibility === 'visible') ||
    (prev.secret_voting && !next.secret_voting) ||
    (prev.anonymous_cards && !next.anonymous_cards)
  );
}
