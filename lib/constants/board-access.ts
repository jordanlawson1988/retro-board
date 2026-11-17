/** The one list of access modes the board GET reports to a caller. */
export const BOARD_ACCESS = ['open', 'completed-closed'] as const;
export type BoardAccess = (typeof BOARD_ACCESS)[number];

export const BOARD_COMPLETED_ERROR = 'Board is completed';

export const COMPLETED_CLOSED_MESSAGE =
  'This retro has been completed. It is no longer open to new participants.';
