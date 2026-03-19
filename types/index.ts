// Board types
export interface Board {
  id: string;
  title: string;
  description: string | null;
  template: BoardTemplate;
  created_by: string;
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
