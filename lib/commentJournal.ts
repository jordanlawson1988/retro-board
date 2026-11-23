import type { CommentChange } from '@/lib/comments';

/**
 * The comment changes applied to the client (answers to its own writes and comment events), newest
 * last. fetchBoard reads commentSeq() before its GET and replays the changes recorded since, so a
 * change applied while the GET was in flight is neither lost nor undone. Same idea as
 * lib/voteTallyVersion.ts. Bounded: only the newest JOURNAL_MAX changes are kept.
 */
const JOURNAL_MAX = 200;

let seq = 0;
let journal: { seq: number; change: CommentChange }[] = [];

export function recordCommentChange(change: CommentChange): void {
  seq += 1;
  journal.push({ seq, change });
  if (journal.length > JOURNAL_MAX) journal = journal.slice(journal.length - JOURNAL_MAX);
}

export function commentSeq(): number {
  return seq;
}

export function commentChangesSince(since: number): CommentChange[] {
  return journal.filter((e) => e.seq > since).map((e) => e.change);
}
