import { describe, it, expect, vi, beforeEach } from 'vitest';

// Ownership is stored in one place (boards.owner_id). The members route derives the
// owner row from it and never writes an owner into board_members.

type Call = { text: string; values: unknown[] };
const mocks = vi.hoisted(() => ({ sql: vi.fn(), session: vi.fn(), owner: vi.fn(), facilitate: vi.fn() }));

vi.mock('@/lib/db', () => ({
  sql: (s: TemplateStringsArray, ...v: unknown[]) => mocks.sql(s.join('?').replace(/\s+/g, ' ').trim(), v),
}));
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock('@/lib/auth-helpers', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth-helpers')>('@/lib/auth-helpers');
  return {
    ...actual,
    getSessionOrNull: () => mocks.session(),
    assertBoardOwner: () => mocks.owner(),
    assertCanFacilitate: () => mocks.facilitate(),
  };
});

import { GET, POST } from '@/app/api/boards/[boardId]/members/route';
import { NextRequest } from 'next/server';

const ctx = { params: Promise.resolve({ boardId: 'b1' }) };
const post = (body: unknown) =>
  POST(new NextRequest('http://x/api/boards/b1/members', { method: 'POST', body: JSON.stringify(body) }), ctx);

let calls: Call[];
function arrange(result: unknown[]) {
  calls = [];
  mocks.sql.mockImplementation(async (text: string, values: unknown[]) => {
    calls.push({ text, values });
    return result;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ user: { id: 'u-owner' } });
  mocks.owner.mockResolvedValue({ userId: 'u-owner' });
  mocks.facilitate.mockResolvedValue({ userId: 'u-owner' });
});

describe('GET members', () => {
  it('derives the owner row from boards.owner_id and excludes owner leftovers in board_members', async () => {
    arrange([
      { id: null, user_id: 'u-owner', role: 'owner', user_email: 'o@x', user_name: 'O' },
      { id: 'm1', user_id: 'u2', role: 'participant', user_email: 'p@x', user_name: 'P' },
    ]);
    const res = await GET(new NextRequest('http://x/api/boards/b1/members'), ctx);
    expect(res.status).toBe(200);
    const q = calls[0];
    expect(q.text).toContain('FROM boards b JOIN "user" u ON u.id = b.owner_id');
    expect(q.text).toContain('bm.role <> ?');
    expect(q.text).toContain('bm.user_id IS DISTINCT FROM b.owner_id');
    expect(q.values.filter((v) => v === 'owner')).toHaveLength(3);
    const { members } = await res.json();
    expect(members.map((m: { role: string }) => m.role)).toEqual(['owner', 'participant']);
  });
});

describe('POST members', () => {
  it("rejects role 'owner': it is not a storable member role", async () => {
    arrange([]);
    const res = await post({ userId: 'u2', role: 'owner' });
    expect(res.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it('writes a member role in one statement that cannot select the owner', async () => {
    arrange([{ user_id: 'u2' }]);
    const res = await post({ userId: 'u2', role: 'facilitator' });
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0].text).toContain('b.owner_id IS DISTINCT FROM ?');
    expect(calls[0].values).toContain('facilitator');
  });

  it('targeting the owner writes nothing and returns 400', async () => {
    arrange([]);
    const res = await post({ userId: 'u-owner', role: 'viewer' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/owner/i);
  });
});
