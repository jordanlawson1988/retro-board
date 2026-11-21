/** Longest group title, in code points. */
export const GROUP_TITLE_MAX = 80;

/** The editor shows a length counter once a title is longer than this many code points. */
export const GROUP_TITLE_COUNTER_FROM = 60;

/** The one list of group actions a guided board accepts. */
export const GROUP_ACTIONS = ['set-title', 'reset'] as const;
export type GroupAction = (typeof GROUP_ACTIONS)[number];
export function isGroupAction(v: unknown): v is GroupAction {
  return typeof v === 'string' && (GROUP_ACTIONS as readonly string[]).includes(v);
}
