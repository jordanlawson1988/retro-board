/** The one list of board modes. `open` is the classic free-form board. */
export const BOARD_MODES = ['open', 'guided'] as const;
export type BoardMode = (typeof BOARD_MODES)[number];
export const OPEN_MODE: BoardMode = BOARD_MODES[0];
export const GUIDED_MODE: BoardMode = BOARD_MODES[1];
export function isBoardMode(v: unknown): v is BoardMode {
  return typeof v === 'string' && (BOARD_MODES as readonly string[]).includes(v);
}

/** The one list of guided phases. This order is the phase order. */
export const PHASE_IDS = ['reflect', 'group', 'vote', 'discuss', 'done'] as const;
export type PhaseId = (typeof PHASE_IDS)[number];
export function isPhaseId(v: unknown): v is PhaseId {
  return typeof v === 'string' && (PHASE_IDS as readonly string[]).includes(v);
}

/** What participants may do in a phase. */
export interface PhaseProfile {
  canWriteCards: boolean;
  canEditCards: boolean;
  canSeeOthersText: boolean;
  canGroup: boolean;
  canVote: boolean;
  canSeeTotals: boolean;
  canComment: boolean;
}

export interface PhaseDef {
  id: PhaseId;
  label: string;
  optional: boolean;
  hasReady: boolean;
  profile: PhaseProfile;
  tips: readonly string[];
}

export const PHASES: Record<PhaseId, PhaseDef> = {
  reflect: {
    id: 'reflect',
    label: 'Reflect',
    optional: false,
    hasReady: true,
    profile: { canWriteCards: true, canEditCards: true, canSeeOthersText: false, canGroup: false, canVote: false, canSeeTotals: false, canComment: false },
    tips: [
      'Write one thought per card.',
      'Nobody can read your cards until this phase ends.',
      'Tap Ready when you have nothing more to add.',
    ],
  },
  group: {
    id: 'group',
    label: 'Group',
    optional: false,
    hasReady: true,
    profile: { canWriteCards: false, canEditCards: true, canSeeOthersText: true, canGroup: true, canVote: false, canSeeTotals: false, canComment: false },
    tips: [
      'Drag a card onto another to group cards that say the same thing.',
      'Keep each group to one topic.',
      'You can still fix typos in your own cards.',
    ],
  },
  vote: {
    id: 'vote',
    label: 'Vote',
    optional: false,
    hasReady: true,
    profile: { canWriteCards: false, canEditCards: false, canSeeOthersText: true, canGroup: false, canVote: true, canSeeTotals: false, canComment: false },
    tips: [
      'Vote for what you most want to talk about.',
      'Votes stay hidden until voting ends.',
      'Tap Ready when your votes are placed.',
    ],
  },
  discuss: {
    id: 'discuss',
    label: 'Discuss',
    optional: false,
    hasReady: false,
    profile: { canWriteCards: false, canEditCards: false, canSeeOthersText: true, canGroup: false, canVote: false, canSeeTotals: true, canComment: true },
    tips: [
      'Start with the cards that got the most votes.',
      'Agree on a next step before moving on.',
      'Give every action item an owner.',
    ],
  },
  done: {
    id: 'done',
    label: 'Done',
    optional: false,
    hasReady: false,
    profile: { canWriteCards: false, canEditCards: false, canSeeOthersText: true, canGroup: false, canVote: false, canSeeTotals: true, canComment: false },
    tips: ['This retro is complete. Cards and votes are read only.'],
  },
};

export const FIRST_PHASE: PhaseId = 'reflect';
export const REOPEN_PHASE: PhaseId = 'discuss';
export const FINAL_PHASE: PhaseId = 'done';

export interface PhaseConfig {
  deadline: string | null;
  /** topic: the current Discuss topic's root card id. Optional, never in DEFAULT_PHASE_CONFIG, so an open board's phase_config stays { deadline: null }. */
  topic?: string | null;
}
export const DEFAULT_PHASE_CONFIG: PhaseConfig = { deadline: null };

/** The phase whose entry sets a topic. */
export const AGENDA_PHASE: PhaseId = 'discuss';

/** The one list of actions the phase route accepts. */
export const PHASE_ROUTE_ACTIONS = ['move', 'set-deadline', 'set-topic'] as const;
export type PhaseRouteAction = (typeof PHASE_ROUTE_ACTIONS)[number];
export function isPhaseRouteAction(v: unknown): v is PhaseRouteAction {
  return typeof v === 'string' && (PHASE_ROUTE_ACTIONS as readonly string[]).includes(v);
}

/** Phase route refusals, declared once. */
export const NOT_GUIDED_ERROR = 'This board is not in guided mode';
export const PHASE_CHANGED_ERROR = 'The phase already changed';

/** Furthest a phase deadline may be set, in days. */
export const DEADLINE_MAX_DAYS = 30;
