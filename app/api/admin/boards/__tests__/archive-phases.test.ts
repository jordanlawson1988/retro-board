import { describe, it, expect, vi, beforeEach } from 'vitest';
import { phaseSettings } from '@/lib/phases';
import { REOPEN_PHASE, FINAL_PHASE } from '@/lib/constants/phases';

const mocks = vi.hoisted(() => ({
  sql: vi.fn(),
  admin: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ sql: (...a: unknown[]) => mocks.sql(...a) }));
vi.mock('@/lib/auth-helpers', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth-helpers')>('@/lib/auth-helpers');
  return { ...actual, requireSystemAdmin: () => mocks.admin() };
});

import { POST } from '@/app/api/admin/boards/route';
import { AuthzError } from '@/lib/auth-helpers';

const req = (body: unknown) => new Request('http://x/api/admin/boards', { method: 'POST', body: JSON.stringify(body) });
const text = (i: number) => (mocks.sql.mock.calls[i][0] as string[]).join('?').replace(/\s+/g, ' ').trim();
const values = (i: number) => mocks.sql.mock.calls[i].slice(1);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.admin.mockResolvedValue({ userId: 'admin' });
});

describe('admin archive', () => {
  it('a guided board: one UPDATE sets the final phase, merges its settings with || and clears the deadline', async () => {
    mocks.sql.mockResolvedValueOnce([{ settings: { voting_enabled: true }, mode: 'guided' }]).mockResolvedValueOnce([]);
    const res = await POST(req({ boardId: 'b1', action: 'archive' }));
    expect(res.status).toBe(200);
    expect(mocks.sql).toHaveBeenCalledTimes(2);
    const update = text(1);
    expect(update).toContain('archived_at = NOW()');
    expect(update).toContain('phase =');
    expect(update).toContain('settings = settings || ');
    expect(update).toContain(`phase_config = phase_config || '{"deadline":null}'::jsonb`);
    expect(values(1)).toContain(FINAL_PHASE);
    expect(values(1)).toContain(JSON.stringify(phaseSettings(FINAL_PHASE)));
  });

  it('an open board: the UPDATE is exactly today\'s statement and parameters', async () => {
    mocks.sql.mockResolvedValueOnce([{ settings: { voting_enabled: true }, mode: 'open' }]).mockResolvedValueOnce([]);
    await POST(req({ boardId: 'b1', action: 'archive' }));
    expect(text(1)).toBe('UPDATE boards SET archived_at = NOW(), settings = ? WHERE id = ?');
    expect(text(1)).not.toContain('phase');
    expect(values(1)).toEqual([JSON.stringify({ voting_enabled: true, board_locked: true }), 'b1']);
  });

  it('a row with no mode (column absent) is treated as open', async () => {
    mocks.sql.mockResolvedValueOnce([{ settings: {}, mode: null }]).mockResolvedValueOnce([]);
    await POST(req({ boardId: 'b1', action: 'archive' }));
    expect(text(1)).toBe('UPDATE boards SET archived_at = NOW(), settings = ? WHERE id = ?');
  });

  it('reads the mode with to_jsonb so it works before migration 015', async () => {
    mocks.sql.mockResolvedValueOnce([{ settings: {}, mode: null }]).mockResolvedValueOnce([]);
    await POST(req({ boardId: 'b1', action: 'archive' }));
    expect(text(0)).toContain("to_jsonb(b) ->> 'mode'");
  });

  it('a missing board still archives as open (today\'s behaviour)', async () => {
    mocks.sql.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const res = await POST(req({ boardId: 'b1', action: 'archive' }));
    expect(res.status).toBe(200);
    expect(text(1)).toBe('UPDATE boards SET archived_at = NOW(), settings = ? WHERE id = ?');
  });
});

describe('admin unarchive', () => {
  it('a guided board: one UPDATE sets the reopen phase, merges its settings with || and clears the deadline', async () => {
    mocks.sql.mockResolvedValueOnce([{ mode: 'guided' }]).mockResolvedValueOnce([]);
    const res = await POST(req({ boardId: 'b1', action: 'unarchive' }));
    expect(res.status).toBe(200);
    expect(mocks.sql).toHaveBeenCalledTimes(2);
    const update = text(1);
    expect(update).toContain('archived_at = NULL');
    expect(update).toContain('phase =');
    expect(update).toContain('settings = settings || ');
    expect(update).toContain(`phase_config = phase_config || '{"deadline":null}'::jsonb`);
    expect(values(1)).toContain(REOPEN_PHASE);
    expect(values(1)).toContain(JSON.stringify(phaseSettings(REOPEN_PHASE)));
  });

  it('an open board: the UPDATE is exactly today\'s statement and parameters', async () => {
    mocks.sql.mockResolvedValueOnce([{ mode: 'open' }]).mockResolvedValueOnce([]);
    await POST(req({ boardId: 'b1', action: 'unarchive' }));
    expect(text(1)).toBe('UPDATE boards SET archived_at = NULL WHERE id = ?');
    expect(text(1)).not.toContain('phase');
    expect(values(1)).toEqual(['b1']);
  });

  it('a row with no mode (column absent) is treated as open', async () => {
    mocks.sql.mockResolvedValueOnce([{ mode: null }]).mockResolvedValueOnce([]);
    await POST(req({ boardId: 'b1', action: 'unarchive' }));
    expect(text(1)).toBe('UPDATE boards SET archived_at = NULL WHERE id = ?');
  });

  it('only the guided statement is guarded by archived_at IS NOT NULL', async () => {
    mocks.sql.mockResolvedValueOnce([{ mode: 'guided' }]).mockResolvedValueOnce([]);
    await POST(req({ boardId: 'b1', action: 'unarchive' }));
    expect(text(1)).toContain('archived_at IS NOT NULL');
    mocks.sql.mockClear();
    mocks.sql.mockResolvedValueOnce([{ mode: 'open' }]).mockResolvedValueOnce([]);
    await POST(req({ boardId: 'b1', action: 'unarchive' }));
    expect(text(1)).not.toContain('archived_at IS NOT NULL');
  });

  it('a board id with no row answers 200 ok with the open statement', async () => {
    mocks.sql.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const res = await POST(req({ boardId: 'nope', action: 'unarchive' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(text(1)).toBe('UPDATE boards SET archived_at = NULL WHERE id = ?');
  });

  it('reads the mode with to_jsonb so it works before migration 015', async () => {
    mocks.sql.mockResolvedValueOnce([{ mode: null }]).mockResolvedValueOnce([]);
    await POST(req({ boardId: 'b1', action: 'unarchive' }));
    expect(text(0)).toContain("to_jsonb(b) ->> 'mode'");
  });
});

describe('authorization', () => {
  it('a non-admin is refused before any statement runs', async () => {
    mocks.admin.mockRejectedValue(new AuthzError(403, 'Forbidden'));
    const res = await POST(req({ boardId: 'b1', action: 'archive' }));
    expect(res.status).toBe(403);
    expect(mocks.sql).not.toHaveBeenCalled();
  });
});
