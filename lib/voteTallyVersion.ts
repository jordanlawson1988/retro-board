/**
 * Counts every vote answer and `vote-tally` event applied to the client. fetchBoard reads it
 * before its GET and again when the GET answers: a changed count means something newer than the
 * GET's snapshot was applied, so the GET's team tally must not replace it.
 * Lives in its own module so the board store, the vote store and the channel hook can all reach
 * it without importing each other.
 */
let version = 0;

export function currentTallyVersion(): number {
  return version;
}

export function bumpTallyVersion(): void {
  version += 1;
}
