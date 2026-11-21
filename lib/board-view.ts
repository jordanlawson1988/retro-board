import type { BoardSettings, Card, Comment, Vote } from '@/types';

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
    if ('group_title' in shaped) shaped.group_title = null;
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

/**
 * Decide what `viewer` may see of `c`. Builds a new object key by key so a column added to the
 * table later never passes through. An anonymous comment carries no author to anyone (a
 * facilitator is just a viewer); its author learns it is theirs from is_mine. A deleted comment
 * carries no body, no author and is nobody's.
 */
export function shapeComment(c: Comment, viewer: Viewer): Comment {
  const deleted = c.deleted_at !== null;
  const hideAuthor = deleted || c.is_anonymous;
  const isMine =
    !deleted &&
    viewer.participantId !== null &&
    c.author_participant_id !== null &&
    c.author_participant_id === viewer.participantId;
  return {
    id: c.id,
    board_id: c.board_id,
    card_id: c.card_id,
    parent_id: c.parent_id,
    author_participant_id: hideAuthor ? null : c.author_participant_id,
    author_name: hideAuthor ? null : c.author_name,
    is_anonymous: c.is_anonymous,
    body: deleted ? '' : c.body,
    created_at: c.created_at,
    edited_at: c.edited_at,
    deleted_at: c.deleted_at,
    is_mine: isMine,
  };
}

export function shapeComments(list: readonly Comment[], viewer: Viewer): Comment[] {
  return list.map((c) => shapeComment(c, viewer));
}
