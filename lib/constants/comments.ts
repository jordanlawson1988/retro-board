/** Longest comment, in code points. */
export const COMMENT_BODY_MAX = 1000;
/** The length counter appears from this many code points. */
export const COMMENT_COUNTER_FROM = 900;
/** Most comments one board holds, deleted ones included. */
export const COMMENTS_PER_BOARD_MAX = 500;

/** The one list of comment events published on the board channel. */
export const COMMENT_EVENTS = ['comment-created', 'comment-updated', 'comment-deleted'] as const;
export type CommentEvent = (typeof COMMENT_EVENTS)[number];
export const COMMENT_CREATED = COMMENT_EVENTS[0];
export const COMMENT_UPDATED = COMMENT_EVENTS[1];
export const COMMENT_DELETED = COMMENT_EVENTS[2];

export const COMMENT_EMPTY_ERROR = 'Write a comment first';
export const COMMENT_TOO_LONG_ERROR = `Comments can be at most ${COMMENT_BODY_MAX} characters`;
export const COMMENT_NOT_FOUND_ERROR = 'Comment not found';
export const COMMENT_TARGET_ERROR = 'Comments go on a topic, not on a card inside it';
export const REPLY_PARENT_ERROR = 'You can only reply to a comment that starts a thread';
export const COMMENT_NOT_YOURS_ERROR = 'Only the author can edit this comment';
export const COMMENT_DELETE_DENIED_ERROR = 'Only the author or a facilitator can delete this comment';
export const COMMENT_GONE_ERROR = 'This comment was deleted';
export const COMMENT_LIMIT_ERROR = `This board has reached its limit of ${COMMENTS_PER_BOARD_MAX} comments`;
export const DELETED_COMMENT_TEXT = 'This comment was deleted.';

export const POST_COMMENT_FALLBACK = 'Failed to post the comment';
export const SAVE_COMMENT_FALLBACK = 'Failed to save the comment';
export const DELETE_COMMENT_FALLBACK = 'Failed to delete the comment';

export const COMMENTS_HEADING = 'Discussion';
export const COMMENTS_EMPTY_WRITABLE = 'No comments yet. Start the discussion.';
export const COMMENTS_EMPTY_READONLY = 'No comments yet.';
export const COMMENT_ANONYMOUS_LABEL = 'Post anonymously';
export const COMMENT_EDITED_MARK = '(edited)';
export const COMMENT_DELETE_PROMPT = 'Delete this comment?';
export const COMMENT_DELETE_PROMPT_WITH_REPLIES = 'Delete this comment? Its replies stay.';
