export const APP_NAME = 'RetroBoard';

export const DEFAULT_BOARD_SETTINGS: import('@/types').BoardSettings = {
  card_visibility: 'hidden',
  voting_enabled: false,
  max_votes_per_participant: 5,
  secret_voting: false,
  board_locked: false,
  card_creation_disabled: false,
  anonymous_cards: false,
  highlighted_card_id: null,
  timer: { duration: 0, remaining: 0, status: 'idle', started_at: null },
};

export const TIMER_PRESETS = [
  { label: '1 min', seconds: 60 },
  { label: '2 min', seconds: 120 },
  { label: '3 min', seconds: 180 },
  { label: '5 min', seconds: 300 },
  { label: '10 min', seconds: 600 },
] as const;

export const MAX_COLUMNS = 10;

export const COLUMN_COLORS = [
  '#DD0031', '#004F71', '#3EB1C8', '#249E6B',
  '#E33205', '#FFB549', '#994878', '#5D5754',
  '#00633B', '#FF1158', '#FA937D', '#B2CFA7',
] as const;

export const CARD_COLORS = [
  { name: 'Default', value: null },
  { name: 'Yellow', value: '#FFB549' },
  { name: 'Blue', value: '#3EB1C8' },
  { name: 'Green', value: '#249E6B' },
  { name: 'Pink', value: '#FBC1B8' },
  { name: 'Orange', value: '#FA937D' },
  { name: 'Cream', value: '#F5E3CC' },
] as const;
