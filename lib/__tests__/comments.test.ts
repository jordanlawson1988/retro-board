import { describe, it, expect } from 'vitest';
import {
  commentLength, clampComment, showCommentCounter, validateCommentBody, commentsReadable, commentsWritable,
  threadsFor, isMyComment, canEditComment, canDeleteComment, canReplyTo, commentAuthorLabel, parseComment,
  mergeIncomingComment, upsertComment, removeComments, replayComments, createCommentOutcome,
  editCommentOutcome, deleteCommentOutcome, type CommentChange,
} from '@/lib/comments';
import type { Comment } from '@/types';

const at = (ms: number) => new Date(Date.UTC(2026, 10, 20, 10, 0, 0, ms)).toISOString();
const comment = (over: Partial<Comment> = {}): Comment => ({
  id: 'm1', board_id: 'b1', card_id: 'L', parent_id: null, author_participant_id: 'p1', author_name: 'Ann',
  is_anonymous: false, body: 'hi', created_at: at(0), edited_at: null, deleted_at: null, ...over,
});

describe('validateCommentBody', () => {
  it('trims a valid body', () => {
    expect(validateCommentBody('  hi  ')).toEqual({ ok: true, value: 'hi' });
  });
  it('refuses a blank body', () => {
    expect(validateCommentBody('   ')).toEqual({ ok: false, error: 'Write a comment first' });
  });
  it('counts an emoji as one character', () => {
    expect(validateCommentBody('😀'.repeat(1000)).ok).toBe(true);
  });
  it('trims before it measures', () => {
    expect(validateCommentBody(' ' + 'x'.repeat(1000) + ' ').ok).toBe(true);
  });
  it('refuses a body over the limit', () => {
    expect(validateCommentBody('x'.repeat(1001))).toEqual({ ok: false, error: 'Comments can be at most 1000 characters' });
  });
  it('refuses a number as an invalid body', () => {
    expect(validateCommentBody(5)).toEqual({ ok: false, error: 'Invalid request body' });
  });
  it('refuses null as an invalid body', () => {
    expect(validateCommentBody(null)).toEqual({ ok: false, error: 'Invalid request body' });
  });
});

describe('comment length helpers', () => {
  it('commentLength counts code points', () => {
    expect(commentLength('😀😀')).toBe(2);
  });
  it('clampComment keeps 1000 code points and never splits a pair', () => {
    const out = clampComment('😀'.repeat(1001));
    expect(commentLength(out)).toBe(1000);
    expect(out).toBe('😀'.repeat(1000));
  });
  it('clampComment leaves a short body as is', () => {
    expect(clampComment('hello')).toBe('hello');
  });
  it('showCommentCounter is false at 899 code points', () => {
    expect(showCommentCounter('x'.repeat(899))).toBe(false);
  });
  it('showCommentCounter is true at 900 code points', () => {
    expect(showCommentCounter('x'.repeat(900))).toBe(true);
  });
});

describe('comment gates', () => {
  it('commentsReadable is true in guided discuss', () => {
    expect(commentsReadable({ mode: 'guided', phase: 'discuss' })).toBe(true);
  });
  it('commentsReadable is true in guided done', () => {
    expect(commentsReadable({ mode: 'guided', phase: 'done' })).toBe(true);
  });
  it('commentsReadable is false in guided vote', () => {
    expect(commentsReadable({ mode: 'guided', phase: 'vote' })).toBe(false);
  });
  it('commentsReadable is false on an open board and on no board', () => {
    expect(commentsReadable({ mode: 'open', phase: null })).toBe(false);
    expect(commentsReadable(null)).toBe(false);
  });
  it('commentsWritable is true in guided discuss when not archived', () => {
    expect(commentsWritable({ mode: 'guided', phase: 'discuss', archived_at: null })).toBe(true);
  });
  it('commentsWritable is false in guided discuss when archived', () => {
    expect(commentsWritable({ mode: 'guided', phase: 'discuss', archived_at: '2026-11-20' })).toBe(false);
  });
  it('commentsWritable is false in guided done', () => {
    expect(commentsWritable({ mode: 'guided', phase: 'done', archived_at: null })).toBe(false);
  });
  it('commentsWritable is false on an open board and on no board', () => {
    expect(commentsWritable({ mode: 'open', phase: null, archived_at: null })).toBe(false);
    expect(commentsWritable(null)).toBe(false);
  });
});

describe('threadsFor', () => {
  it('returns top-level comments on the topic cards oldest first', () => {
    const list = [
      comment({ id: 'b', card_id: 'k', created_at: at(5) }),
      comment({ id: 'a', card_id: 'L', created_at: at(2) }),
    ];
    expect(threadsFor(list, ['L', 'k']).map((t) => t.top.id)).toEqual(['a', 'b']);
  });
  it('leaves out a comment on another card', () => {
    const list = [comment({ id: 'a', card_id: 'L' }), comment({ id: 'x', card_id: 'other' })];
    expect(threadsFor(list, ['L', 'k']).map((t) => t.top.id)).toEqual(['a']);
  });
  it('attaches replies under their parent oldest first', () => {
    const list = [
      comment({ id: 'r2', parent_id: 'a', created_at: at(9) }),
      comment({ id: 'a', created_at: at(1) }),
      comment({ id: 'r1', parent_id: 'a', created_at: at(4) }),
    ];
    const threads = threadsFor(list, ['L']);
    expect(threads).toHaveLength(1);
    expect(threads[0].replies.map((r) => r.id)).toEqual(['r1', 'r2']);
  });
  it('leaves out a reply whose parent is not in the list', () => {
    const list = [comment({ id: 'a' }), comment({ id: 'r', parent_id: 'missing', created_at: at(3) })];
    const threads = threadsFor(list, ['L']);
    expect(threads.map((t) => t.top.id)).toEqual(['a']);
    expect(threads[0].replies).toEqual([]);
  });
  it('keeps a deleted top-level comment that has replies', () => {
    const list = [
      comment({ id: 'a', body: '', deleted_at: at(7), author_participant_id: null, author_name: null }),
      comment({ id: 'r', parent_id: 'a', created_at: at(8) }),
    ];
    const threads = threadsFor(list, ['L']);
    expect(threads.map((t) => t.top.id)).toEqual(['a']);
    expect(threads[0].replies.map((r) => r.id)).toEqual(['r']);
  });
});

describe('threadsFor lone tombstones', () => {
  it('leaves out a deleted top-level comment with no replies', () => {
    const list = [comment({ id: 'a' }), comment({ id: 'd', body: '', deleted_at: at(7), author_participant_id: null, author_name: null })];
    expect(threadsFor(list, ['L']).map((t) => t.top.id)).toEqual(['a']);
  });
  it('keeps a deleted top-level comment that still has a reply', () => {
    const list = [
      comment({ id: 'd', body: '', deleted_at: at(7), author_participant_id: null, author_name: null }),
      comment({ id: 'r', parent_id: 'd', created_at: at(8) }),
    ];
    expect(threadsFor(list, ['L']).map((t) => t.top.id)).toEqual(['d']);
  });
});

describe('author and permissions', () => {
  it('isMyComment accepts is_mine or a matching participant id', () => {
    expect(isMyComment(comment({ author_participant_id: null, is_mine: true }), 'p9')).toBe(true);
    expect(isMyComment(comment(), 'p1')).toBe(true);
    expect(isMyComment(comment(), 'p2')).toBe(false);
    expect(isMyComment(comment(), null)).toBe(false);
  });
  it('commentAuthorLabel says You for mine', () => {
    expect(commentAuthorLabel(comment(), 'p1')).toBe('You');
  });
  it('commentAuthorLabel says You (anonymous) for my anonymous comment', () => {
    const c = comment({ is_anonymous: true, is_mine: true, author_participant_id: null, author_name: null });
    expect(commentAuthorLabel(c, 'p1')).toBe('You (anonymous)');
  });
  it('commentAuthorLabel says Anonymous for someone else anonymous', () => {
    const c = comment({ is_anonymous: true, author_participant_id: null, author_name: null });
    expect(commentAuthorLabel(c, 'p2')).toBe('Anonymous');
  });
  it('commentAuthorLabel gives the author name for someone else', () => {
    expect(commentAuthorLabel(comment(), 'p2')).toBe('Ann');
  });
  it('commentAuthorLabel is empty for a deleted comment', () => {
    expect(commentAuthorLabel(comment({ deleted_at: at(1), body: '' }), 'p1')).toBe('');
  });
  it('canEditComment is true for mine when writable', () => {
    expect(canEditComment(comment(), 'p1', true)).toBe(true);
  });
  it('canEditComment is false for a deleted comment', () => {
    expect(canEditComment(comment({ deleted_at: at(1) }), 'p1', true)).toBe(false);
  });
  it('canEditComment is false for someone else\'s comment', () => {
    expect(canEditComment(comment(), 'p2', true)).toBe(false);
  });
  it('canEditComment is false when not writable', () => {
    expect(canEditComment(comment(), 'p1', false)).toBe(false);
  });
  it('canDeleteComment is true for the author', () => {
    expect(canDeleteComment(comment(), 'p1', false, true)).toBe(true);
  });
  it('canDeleteComment is true for a facilitator on someone else\'s comment', () => {
    expect(canDeleteComment(comment(), 'p2', true, true)).toBe(true);
  });
  it('canDeleteComment is false for a participant on someone else\'s comment', () => {
    expect(canDeleteComment(comment(), 'p2', false, true)).toBe(false);
  });
  it('canDeleteComment is false when deleted or not writable', () => {
    expect(canDeleteComment(comment({ deleted_at: at(1) }), 'p1', true, true)).toBe(false);
    expect(canDeleteComment(comment(), 'p1', true, false)).toBe(false);
  });
  it('canReplyTo is true for a live top-level comment when writable', () => {
    expect(canReplyTo(comment(), true)).toBe(true);
  });
  it('canReplyTo is false for a reply', () => {
    expect(canReplyTo(comment({ parent_id: 'm0' }), true)).toBe(false);
  });
  it('canReplyTo is false for a deleted comment', () => {
    expect(canReplyTo(comment({ deleted_at: at(1) }), true)).toBe(false);
  });
  it('canReplyTo is false when not writable', () => {
    expect(canReplyTo(comment(), false)).toBe(false);
  });
});

describe('parseComment', () => {
  it('accepts a well formed comment', () => {
    expect(parseComment(comment())).toEqual(comment());
  });
  it('rejects null', () => {
    expect(parseComment(null)).toBeNull();
  });
  it('rejects an empty object', () => {
    expect(parseComment({})).toBeNull();
  });
  it('rejects a body that is a number', () => {
    expect(parseComment({ ...comment(), body: 5 })).toBeNull();
  });
});

describe('merging and replay', () => {
  it('mergeIncomingComment keeps is_mine from the local copy and takes the new body', () => {
    const c = comment();
    const merged = mergeIncomingComment({ ...c, is_mine: true }, { ...c, is_mine: false, body: 'new' });
    expect(merged.is_mine).toBe(true);
    expect(merged.body).toBe('new');
  });
  it('mergeIncomingComment with no local copy takes the incoming flag', () => {
    expect(mergeIncomingComment(undefined, comment({ is_mine: true })).is_mine).toBe(true);
    expect(mergeIncomingComment(undefined, comment()).is_mine).toBe(false);
  });
  it('upsertComment appends a new id', () => {
    const out = upsertComment([comment({ id: 'm1' })], comment({ id: 'm2' }));
    expect(out.map((c) => c.id)).toEqual(['m1', 'm2']);
  });
  it('upsertComment replaces an existing id through mergeIncomingComment', () => {
    const out = upsertComment([comment({ id: 'm1', is_mine: true })], comment({ id: 'm1', body: 'edited' }));
    expect(out).toHaveLength(1);
    expect(out[0].body).toBe('edited');
    expect(out[0].is_mine).toBe(true);
  });
  it('removeComments drops the ids and replaces the tombstone row', () => {
    const tombstone = comment({ id: 'm1', body: '', deleted_at: at(5), author_participant_id: null, author_name: null });
    const out = removeComments([comment({ id: 'm1' }), comment({ id: 'm2' })], ['m2'], tombstone);
    expect(out).toEqual([{ ...tombstone, is_mine: false }]);
  });
  it('removeComments appends a tombstone whose row is not in the list', () => {
    const tombstone = comment({ id: 'm5', body: '', deleted_at: at(5), author_participant_id: null, author_name: null });
    const out = removeComments([comment({ id: 'm1' }), comment({ id: 'm2' })], ['m2'], tombstone);
    expect(out.map((c) => c.id)).toEqual(['m1', 'm5']);
    expect(out[1].deleted_at).toBe(at(5));
  });
  it('removeComments applied twice gives the same list', () => {
    const tombstone = comment({ id: 'm5', body: '', deleted_at: at(5), author_participant_id: null, author_name: null });
    const once = removeComments([comment({ id: 'm1' }), comment({ id: 'm2' })], ['m2'], tombstone);
    expect(removeComments(once, ['m2'], tombstone)).toEqual(once);
  });
  it('removeComments without a tombstone only drops', () => {
    expect(removeComments([comment({ id: 'm1' }), comment({ id: 'm2' })], ['m2'], null).map((c) => c.id)).toEqual(['m1']);
  });
  it('replayComments adds a comment upserted after the GET started', () => {
    const changes: CommentChange[] = [{ boardId: 'b1', kind: 'upsert', comment: comment({ id: 'm2' }) }];
    expect(replayComments([comment({ id: 'm1' })], changes, 'b1').map((c) => c.id)).toEqual(['m1', 'm2']);
  });
  it('replayComments removes a comment removed after the GET started', () => {
    const changes: CommentChange[] = [{ boardId: 'b1', kind: 'remove', ids: ['m1'], tombstone: null }];
    expect(replayComments([comment({ id: 'm1' }), comment({ id: 'm2' })], changes, 'b1').map((c) => c.id)).toEqual(['m2']);
  });
  it('replayComments ignores a change for another board', () => {
    const changes: CommentChange[] = [
      { boardId: 'b2', kind: 'upsert', comment: comment({ id: 'm9', board_id: 'b2' }) },
      { boardId: 'b2', kind: 'remove', ids: ['m1'], tombstone: null },
    ];
    expect(replayComments([comment({ id: 'm1' })], changes, 'b1').map((c) => c.id)).toEqual(['m1']);
  });
  it('replayComments applies changes in order', () => {
    const changes: CommentChange[] = [
      { boardId: 'b1', kind: 'upsert', comment: comment({ id: 'm2' }) },
      { boardId: 'b1', kind: 'remove', ids: ['m2'], tombstone: null },
    ];
    expect(replayComments([], changes, 'b1')).toEqual([]);
  });
});

describe('createCommentOutcome', () => {
  const row = { board_ok: true, card_found: 1, card_parent: null, parent_ok: true, comment_count: 3, id: 'm1' };
  it('is phase-changed with no row', () => {
    expect(createCommentOutcome(undefined, false, 500)).toBe('phase-changed');
  });
  it('is phase-changed when the board check failed', () => {
    expect(createCommentOutcome({ ...row, board_ok: false }, false, 500)).toBe('phase-changed');
  });
  it('is card-missing when the card is not found', () => {
    expect(createCommentOutcome({ ...row, card_found: 0 }, false, 500)).toBe('card-missing');
  });
  it('is not-a-topic for a top-level comment on a card with a parent', () => {
    expect(createCommentOutcome({ ...row, card_parent: 'L' }, false, 500)).toBe('not-a-topic');
  });
  it('allows a reply on a card with a parent only through the parent check', () => {
    expect(createCommentOutcome({ ...row, card_parent: 'L' }, true, 500)).toBe('ok');
  });
  it('is bad-parent for a reply whose parent is not ok', () => {
    expect(createCommentOutcome({ ...row, parent_ok: false }, true, 500)).toBe('bad-parent');
  });
  it('ignores parent_ok for a top-level comment', () => {
    expect(createCommentOutcome({ ...row, parent_ok: false }, false, 500)).toBe('ok');
  });
  it('is limit at the cap', () => {
    expect(createCommentOutcome({ ...row, comment_count: 500 }, false, 500)).toBe('limit');
  });
  it('is ok below the cap with an id', () => {
    expect(createCommentOutcome({ ...row, comment_count: 499 }, false, 500)).toBe('ok');
  });
  it('is phase-changed when everything passes but the id is null', () => {
    expect(createCommentOutcome({ ...row, id: null }, false, 500)).toBe('phase-changed');
  });
});

describe('editCommentOutcome', () => {
  const row = { board_ok: true, found: 1, is_deleted: false, is_author: true, id: 'm1' };
  it('is missing with no row', () => {
    expect(editCommentOutcome(undefined)).toBe('missing');
  });
  it('is phase-changed when the board check failed', () => {
    expect(editCommentOutcome({ ...row, board_ok: false })).toBe('phase-changed');
  });
  it('is missing when not found', () => {
    expect(editCommentOutcome({ ...row, found: 0, is_deleted: null, is_author: null })).toBe('missing');
  });
  it('is gone when the comment was deleted', () => {
    expect(editCommentOutcome({ ...row, is_deleted: true })).toBe('gone');
  });
  it('is not-yours when the caller is not the author', () => {
    expect(editCommentOutcome({ ...row, is_author: false })).toBe('not-yours');
  });
  it('is ok with an id', () => {
    expect(editCommentOutcome(row)).toBe('ok');
  });
  it('is phase-changed when everything passes but the id is null', () => {
    expect(editCommentOutcome({ ...row, id: null })).toBe('phase-changed');
  });
});

describe('deleteCommentOutcome', () => {
  const row = { board_ok: true, found: 1, already_deleted: false, permitted: true };
  it('is missing with no row', () => {
    expect(deleteCommentOutcome(undefined)).toBe('missing');
  });
  it('is phase-changed when the board check failed', () => {
    expect(deleteCommentOutcome({ ...row, board_ok: false })).toBe('phase-changed');
  });
  it('is missing when not found', () => {
    expect(deleteCommentOutcome({ ...row, found: 0, already_deleted: null })).toBe('missing');
  });
  it('is gone when already deleted', () => {
    expect(deleteCommentOutcome({ ...row, already_deleted: true })).toBe('gone');
  });
  it('is denied when not permitted', () => {
    expect(deleteCommentOutcome({ ...row, permitted: false })).toBe('denied');
  });
  it('is ok when permitted', () => {
    expect(deleteCommentOutcome(row)).toBe('ok');
  });
});

describe('outcome precedence', () => {
  const create = { board_ok: true, card_found: 1, card_parent: null, parent_ok: true, comment_count: 3, id: 'm1' };
  it('createCommentOutcome: a moved board beats a missing card', () => {
    expect(createCommentOutcome({ ...create, board_ok: false, card_found: 0 }, false, 500)).toBe('phase-changed');
  });
  it('createCommentOutcome: a missing card beats the limit', () => {
    expect(createCommentOutcome({ ...create, card_found: 0, comment_count: 500 }, false, 500)).toBe('card-missing');
  });
  it('createCommentOutcome: a child card beats the limit', () => {
    expect(createCommentOutcome({ ...create, card_parent: 'L', comment_count: 500 }, false, 500)).toBe('not-a-topic');
  });
  it('createCommentOutcome: a bad parent beats the limit', () => {
    expect(createCommentOutcome({ ...create, parent_ok: false, comment_count: 500 }, true, 500)).toBe('bad-parent');
  });
  const edit = { board_ok: true, found: 1, is_deleted: false, is_author: true, id: 'm1' };
  it('editCommentOutcome: a moved board beats a missing comment', () => {
    expect(editCommentOutcome({ ...edit, board_ok: false, found: 0, is_deleted: null, is_author: null })).toBe('phase-changed');
  });
  it('editCommentOutcome: gone beats not-yours', () => {
    expect(editCommentOutcome({ ...edit, is_deleted: true, is_author: false })).toBe('gone');
  });
  const del = { board_ok: true, found: 1, already_deleted: false, permitted: true };
  it('deleteCommentOutcome: a moved board beats a missing comment', () => {
    expect(deleteCommentOutcome({ ...del, board_ok: false, found: 0, already_deleted: null })).toBe('phase-changed');
  });
  it('deleteCommentOutcome: gone beats denied', () => {
    expect(deleteCommentOutcome({ ...del, already_deleted: true, permitted: false })).toBe('gone');
  });
});
