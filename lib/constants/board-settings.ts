/** The one list of card visibility modes a board can be in. */
export const CARD_VISIBILITIES = ['hidden', 'visible'] as const;
export type CardVisibility = (typeof CARD_VISIBILITIES)[number];

/** The one list of timer states. */
export const TIMER_STATUSES = ['idle', 'running', 'paused', 'expired'] as const;
export type TimerStatus = (typeof TIMER_STATUSES)[number];

/** Votes per participant: whole number in this range (matches the admin settings input). */
export const MAX_VOTES_PER_PARTICIPANT_RANGE = { min: 1, max: 99 } as const;

/** Votes on one card per participant (guided boards only): whole number in this range. */
export const MAX_VOTES_PER_CARD_RANGE = { min: 1, max: 12 } as const;
/** Per-card limit a new guided board starts with. */
export const GUIDED_MAX_VOTES_PER_CARD = 3;
/** Per-card limit an open board always reads as (one vote per card). */
export const OPEN_MAX_VOTES_PER_CARD = 1;

/** Longest timer, in seconds (24 hours). */
export const TIMER_MAX_SECONDS = 86_400;

/** Longest id stored in highlighted_card_id. */
export const HIGHLIGHTED_ID_MAX = 200;
