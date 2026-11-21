/** The one list of actions that board write routes guard through `checkAction`. */
export const BOARD_ACTIONS = [
  'card.create',
  'card.edit',
  'card.delete',
  'card.move',
  'group.title',
  'group.reset',
  'card.react',
  'vote.toggle',
  'column.write',
  'participant.manage',
  'participant.leave',
  'action-item.write',
  'board.settings',
] as const;

export type BoardAction = (typeof BOARD_ACTIONS)[number];
