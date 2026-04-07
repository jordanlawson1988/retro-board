// Board types
export interface Board {
  id: string;
  title: string;
  description: string | null;
  template: BoardTemplate;
  created_by: string;
  owner_id: string | null;       // Better Auth user ID (null for anonymous/legacy)
  visibility: 'link' | 'invite_only';
  join_code: string;             // 5-digit code for easy sharing
  settings: BoardSettings;
  created_at: string;
  archived_at: string | null;
}

export type BoardTemplate =
  | 'mad-sad-glad'
  | 'liked-learned-lacked'
  | 'start-stop-continue'
  | 'went-well-didnt-action'
  | 'custom';

export type BoardView = 'grid' | 'swimlane' | 'list' | 'timeline';
export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnected' | 'polling';

export interface BoardSettings {
  card_visibility: 'hidden' | 'visible';
  voting_enabled: boolean;
  max_votes_per_participant: number;
  secret_voting: boolean;
  board_locked: boolean;
  card_creation_disabled: boolean;
  anonymous_cards: boolean;
  timer: TimerState;
  highlighted_card_id: string | null;
}

export interface TimerState {
  duration: number; // total seconds
  remaining: number; // seconds remaining
  status: 'idle' | 'running' | 'paused' | 'expired';
  started_at: string | null;
}

// Column types
export interface Column {
  id: string;
  board_id: string;
  title: string;
  description: string | null;
  color: string;
  position: number;
  created_at: string;
}

// Card types
export interface Card {
  id: string;
  column_id: string;
  board_id: string;
  text: string;
  author_name: string;
  author_id: string;
  color: string | null;
  position: number;
  merged_with: string | null;
  created_at: string;
  updated_at: string;
  votes?: Vote[];
  vote_count?: number;
}

// Vote types
export interface Vote {
  id: string;
  card_id: string;
  board_id: string;
  voter_id: string;
  created_at: string;
}

// Action Item types
export type ActionItemStatus = 'open' | 'in_progress' | 'done';

export interface ActionItem {
  id: string;
  board_id: string;
  description: string;
  assignee: string | null;
  due_date: string | null;
  status: ActionItemStatus;
  created_at: string;
}

// Participant types
export interface Participant {
  id: string;
  board_id: string;
  display_name: string;
  is_admin: boolean;
  user_id: string | null;        // Better Auth user ID (null for anonymous)
  joined_at: string;
  last_seen: string;
}

// Template definitions
export interface TemplateDefinition {
  id: BoardTemplate;
  name: string;
  description: string;
  columns: { title: string; color: string; description?: string }[];
}

// Board history (localStorage)
export interface BoardHistoryEntry {
  boardId: string;
  title: string;
  createdAt: string;
  lastVisited: string;
  isCompleted: boolean;
}

// Admin types
export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_enabled: boolean;
  updated_at: string;
  created_at: string;
}

export interface AppSettings {
  id: string;
  default_template: BoardTemplate;
  default_board_settings: Partial<BoardSettings>;
  app_name: string;
  app_logo_url: string | null;
  board_retention_days: number | null;
  updated_at: string;
}

export interface AdminUser {
  id: string;
  email: string;
  role: 'owner' | 'admin';
  created_at: string;
}

// User types (Better Auth user — subset of fields we use)
export interface User {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  createdAt?: Date | string;
}

// Board membership
export type BoardMemberRole = 'owner' | 'facilitator' | 'participant' | 'viewer';

export interface BoardMember {
  id: string;
  board_id: string;
  user_id: string;
  role: BoardMemberRole;
  invited_by: string | null;
  joined_at: string;
  // Joined from user table for display
  user_email?: string;
  user_name?: string;
}

// Board invites
export interface BoardInvite {
  id: string;
  board_id: string;
  email: string;
  role: BoardMemberRole;
  token: string;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
}

// Subscription (Better Auth Stripe plugin shape)
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete';

export interface Subscription {
  id: string;
  plan: string;
  status: SubscriptionStatus;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

// Plan limits
export const PLAN_LIMITS = {
  free: { maxActiveBoards: 3, pdfExport: false, imageExport: false },
  pro: { maxActiveBoards: Infinity, pdfExport: true, imageExport: true },
} as const;

export type PlanTier = keyof typeof PLAN_LIMITS;
