/** The one list of access modes the board GET reports to a caller. */
export const BOARD_ACCESS = ['open', 'completed-closed'] as const;
export type BoardAccess = (typeof BOARD_ACCESS)[number];

export const BOARD_COMPLETED_ERROR = 'Board is completed';

export const COMPLETED_CLOSED_MESSAGE =
  'This retro has been completed. It is no longer open to new participants.';

/** The 401 text for a caller who has not joined the board. Shared by the server helpers and the client-safe guards. */
export const JOIN_FIRST_ERROR = 'Join the board first';
