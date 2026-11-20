/** The one list of vote actions a guided board accepts. */
export const VOTE_ACTIONS = ['add', 'remove'] as const;
export type VoteAction = (typeof VOTE_ACTIONS)[number];
export function isVoteAction(v: unknown): v is VoteAction {
  return typeof v === 'string' && (VOTE_ACTIONS as readonly string[]).includes(v);
}
