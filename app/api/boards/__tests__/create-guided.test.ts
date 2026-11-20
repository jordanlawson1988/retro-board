import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FIRST_PHASE, DEFAULT_PHASE_CONFIG } from '@/lib/constants/phases';
import { phaseSettings } from '@/lib/phases';

// Guided create: the phase columns are written only for a guided board; an open create keeps
// its exact statement (so it still works on a database that has no migration 015).

type Call = { text: string; values: unknown[] };
const mocks = vi.hoisted(() => ({ tx: vi.fn(), session: vi.fn(), canUse: vi.fn() }));

vi.mock('@/lib/db', () => ({
  sqlTransaction: (build: (t: unknown) => unknown[]) => mocks.tx(build),
}));
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock('@/lib/auth-helpers', () => ({ getSessionOrNull: () => mocks.session() }));
vi.mock('@/lib/rate-limit', () => ({ rateLimitOr429: async () => null }));
vi.mock('@/lib/participant-session', () => ({ setParticipantCookie: vi.fn() }));
vi.mock('@/lib/can-use', () => ({ canUse: (...a: unknown[]) => mocks.canUse(...a) }));

import { POST } from '@/app/api/boards/route';

let txCalls: Call[];
beforeEach(() => {
  vi.clearAllMocks();
  txCalls = [];
  mocks.session.mockResolvedValue({ user: { id: 'u1' } });
  mocks.canUse.mockResolvedValue(true);
  mocks.tx.mockImplementation(async (build: (t: unknown) => unknown[]) => {
    const t = (s: TemplateStringsArray, ...v: unknown[]) => {
      const c = { text: s.join('?').replace(/\s+/g, ' ').trim(), values: v };
      txCalls.push(c);
      return c;
    };
    return build(t).map(() => []);
  });
});

const baseBody = {
  id: 'abcdefghij',
  title: 'T',
  description: null,
  template: 'start-stop-continue',
  settings: {
    card_visibility: 'visible', voting_enabled: false, max_votes_per_participant: 5, secret_voting: false,
    board_locked: false, card_creation_disabled: false, anonymous_cards: true, highlighted_card_id: null,
    timer: { duration: 0, remaining: 0, status: 'idle', started_at: null },
  },
  columns: [{ id: 'col1234567', title: 'C', description: null, color: '#cccccc', position: 0 }],
  participant: { displayName: 'Ann' },
};
const call = (over: Record<string, unknown> = {}) =>
  POST(
    new Request('http://x/api/boards', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...baseBody, ...over }),
    })
  );
const boardInsert = () => txCalls.find((c) => c.text.startsWith('INSERT INTO boards'));

describe('POST /api/boards guided mode', () => {
  it('a guided board is inserted in reflect with the reflect settings over the body settings', async () => {
    const res = await call({ mode: 'guided' });
    expect(res.status).toBe(200);
    expect(mocks.canUse).toHaveBeenCalledWith('guided_mode', 'u1');
    const ins = boardInsert()!;
    expect(ins.text).toContain('mode');
    expect(ins.text).toContain('phase');
    expect(ins.text).toContain('phase_config');
    expect(ins.values).toContain('guided');
    expect(ins.values).toContain(FIRST_PHASE);
    expect(ins.values).toContain(JSON.stringify(DEFAULT_PHASE_CONFIG));
    const settingsJson = ins.values.find((v) => typeof v === 'string' && v.startsWith('{"card_visibility"')) as string;
    const settings = JSON.parse(settingsJson);
    expect(settings).toEqual({ ...baseBody.settings, ...phaseSettings(FIRST_PHASE), max_votes_per_card: 3 });
    // Reflect hides cards even though the body said visible; unowned keys keep the body value.
    expect(settings.card_visibility).toBe('hidden');
    expect(settings.anonymous_cards).toBe(true);
    expect(ins.text).toContain('trust_version');
    expect(ins.text).toContain('?, 2, ?, ?, ?::jsonb)');
  });

  it('a guided board whose per-person limit is 2 gets 2 per card', async () => {
    await call({ mode: 'guided', settings: { ...baseBody.settings, max_votes_per_participant: 2 } });
    const settingsJson = boardInsert()!.values.find((v) => typeof v === 'string' && v.startsWith('{"card_visibility"')) as string;
    expect(JSON.parse(settingsJson).max_votes_per_card).toBe(2);
  });

  it('an open board is inserted without max_votes_per_card', async () => {
    await call();
    expect(boardInsert()!.values.some((v) => typeof v === 'string' && v.includes('max_votes_per_card'))).toBe(false);
  });

  it('403 when the guided_mode flag is off, and nothing is inserted', async () => {
    mocks.canUse.mockResolvedValue(false);
    const res = await call({ mode: 'guided' });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Guided mode is not available' });
    expect(mocks.tx).not.toHaveBeenCalled();
    expect(txCalls).toHaveLength(0);
  });

  it('a throwing flag lookup inserts nothing and is a 500', async () => {
    mocks.canUse.mockRejectedValue(new Error('db down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await call({ mode: 'guided' });
    spy.mockRestore();
    expect(res.status).toBe(500);
    expect(mocks.tx).not.toHaveBeenCalled();
    expect(txCalls).toHaveLength(0);
  });

  it('an invalid mode is 400 with no flag lookup and no insert', async () => {
    const res = await call({ mode: 'party' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid mode' });
    expect(mocks.canUse).not.toHaveBeenCalled();
    expect(mocks.tx).not.toHaveBeenCalled();
  });

  it('an open board does not query feature_flags and does not name the new columns', async () => {
    for (const over of [{}, { mode: 'open' }]) {
      txCalls = [];
      const res = await call(over);
      expect(res.status).toBe(200);
      expect(mocks.canUse).not.toHaveBeenCalled();
      const ins = boardInsert()!;
      expect(ins.text).toBe(
        'INSERT INTO boards (id, title, description, template, created_by, owner_id, join_code, settings, trust_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 2)'
      );
      expect(ins.values).toContain(JSON.stringify(baseBody.settings));
    }
  });
});
