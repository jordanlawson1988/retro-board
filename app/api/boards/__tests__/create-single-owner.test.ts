import { describe, it, expect, vi, beforeEach } from 'vitest';

// A signed-in creator is recorded as the owner in boards.owner_id only.
// Board creation must not write a board_members row for them.

type Call = { text: string; values: unknown[] };
const mocks = vi.hoisted(() => ({ tx: vi.fn(), session: vi.fn() }));

vi.mock('@/lib/db', () => ({
  sqlTransaction: (build: (t: unknown) => unknown[]) => mocks.tx(build),
}));
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock('@/lib/auth-helpers', () => ({ getSessionOrNull: () => mocks.session() }));
vi.mock('@/lib/rate-limit', () => ({ rateLimitOr429: async () => null }));
vi.mock('@/lib/participant-session', () => ({ setParticipantCookie: vi.fn() }));

import { POST } from '@/app/api/boards/route';

let txCalls: Call[];
beforeEach(() => {
  vi.clearAllMocks();
  txCalls = [];
  mocks.tx.mockImplementation(async (build: (t: unknown) => unknown[]) => {
    const t = (s: TemplateStringsArray, ...v: unknown[]) => {
      const c = { text: s.join('?').replace(/\s+/g, ' ').trim(), values: v };
      txCalls.push(c);
      return c;
    };
    return build(t).map(() => []);
  });
});

const body = {
  id: 'abcdefghij',
  title: 'T',
  description: null,
  template: 'start-stop-continue',
  settings: {
    card_visibility: 'hidden', voting_enabled: false, max_votes_per_participant: 5, secret_voting: false,
    board_locked: false, card_creation_disabled: false, anonymous_cards: false, highlighted_card_id: null,
    timer: { duration: 0, remaining: 0, status: 'idle', started_at: null },
  },
  columns: [{ id: 'col1234567', title: 'C', description: null, color: '#cccccc', position: 0 }],
  participant: { displayName: 'Ann' },
};
const call = () =>
  POST(new Request('http://x/api/boards', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));

describe('POST /api/boards ownership', () => {
  it('signed-in creator: owner_id on the board, no board_members write', async () => {
    mocks.session.mockResolvedValue({ user: { id: 'u1' } });
    const res = await call();
    expect(res.status).toBe(200);
    const board = txCalls.find((c) => c.text.startsWith('INSERT INTO boards'));
    expect(board?.values).toContain('u1');
    expect(txCalls.some((c) => c.text.includes('board_members'))).toBe(false);
  });

  it('anonymous creator: owner_id is null, no board_members write', async () => {
    mocks.session.mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(200);
    const board = txCalls.find((c) => c.text.startsWith('INSERT INTO boards'));
    expect(board?.values[5]).toBeNull();
    expect(txCalls.some((c) => c.text.includes('board_members'))).toBe(false);
  });
});
