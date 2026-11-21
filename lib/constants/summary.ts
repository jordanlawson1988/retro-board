import type { ActionItemStatus } from '@/types';

/** Retro summary page copy, declared once. */
export const SUMMARY_PAGE_TITLE = 'Retro summary';
export const BACK_TO_BOARD = 'Back to the board';
export const PRINT_BUTTON = 'Print or save as PDF';
export const AT_A_GLANCE = 'At a glance';
export const SUMMARY_TOPICS = 'Topics';
export const NO_TOPICS_DISCUSSED = 'No topics were discussed.';
export const SUMMARY_CARDS = 'Cards';
export const SUMMARY_DISCUSSION = 'Discussion';
export const NO_COMMENTS = 'No comments.';
export const SUMMARY_TOPIC_ACTIONS = 'Action items';
export const NO_TOPIC_ACTIONS = 'No action items for this topic.';
export const OTHER_ACTIONS = 'Other action items';
export const SUMMARY_PARTICIPANTS = 'Participants';
export const OWNER_PREFIX = 'Owner: ';
export const DUE_PREFIX = 'Due: ';
export const SUMMARY_NOT_READY = 'This summary will be ready when the retro is completed.';
export const SUMMARY_SIGN_IN_PROMPT = 'Took part with an account?';
export const SUMMARY_SIGN_IN_LINK = 'Sign in to see the summary';
export const SUMMARY_LOADING = 'Loading summary...';
export const SUMMARY_LOAD_FAILED = 'Could not load the summary.';
export const SUMMARY_RETRY = 'Try again';
export const SUMMARY_COMPLETED_BAR = 'This retro is completed.';
export const VIEW_SUMMARY = 'View summary';
export const SUMMARY_PRINT_FOOTER_PREFIX = 'From RetroBoard: ';
export const GO_HOME = 'Go Home';
export const BOARD_NOT_FOUND_TITLE = 'Board not found';

/** A summary is printed and forwarded, so an anonymous comment reads the same for every reader. */
export const SUMMARY_ANONYMOUS = 'Anonymous';

/** Exhaustive over ACTION_ITEM_STATUSES through the Record type. */
export const ACTION_ITEM_STATUS_LABELS: Record<ActionItemStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  done: 'Done',
};
