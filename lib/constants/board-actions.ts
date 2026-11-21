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
  'topic.set',
  'comment.create',
  'comment.edit',
  'comment.delete',
  'column.write',
  'participant.manage',
  'participant.leave',
  'action-item.write',
  'action-item.link',
  'board.settings',
] as const;

export type BoardAction = (typeof BOARD_ACTIONS)[number];
