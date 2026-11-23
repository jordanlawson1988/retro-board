import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({ after: vi.fn(), dispatch: vi.fn() }));
vi.mock('next/server', () => ({ after: (...a: unknown[]) => mocks.after(...a) }));
vi.mock('@/lib/summary-email/dispatch', () => ({ dispatchSummaryEmail: (...a: unknown[]) => mocks.dispatch(...a) }));

import { scheduleSummaryEmail } from '@/lib/summary-email/schedule';

const input = { boardId: 'b-123', completedAt: '2026-11-21T10:00:00.000Z' };

let info: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.clearAllMocks();
  info = vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => info.mockRestore());

describe('scheduleSummaryEmail', () => {
  it('does not throw and does not dispatch when after has no request scope', () => {
    mocks.after.mockImplementation(() => {
      throw new Error('after was called outside a request scope');
    });
    expect(() => scheduleSummaryEmail(input)).not.toThrow();
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it('runs the dispatch once with the same input and logs the board id and the outcome only', async () => {
    let cb: (() => Promise<void>) | undefined;
    mocks.after.mockImplementation((f: () => Promise<void>) => { cb = f; });
    mocks.dispatch.mockResolvedValue('recorded');
    scheduleSummaryEmail(input);
    expect(mocks.dispatch).not.toHaveBeenCalled();
    await cb!();
    expect(mocks.dispatch).toHaveBeenCalledTimes(1);
    expect(mocks.dispatch).toHaveBeenCalledWith(input);
    expect(info).toHaveBeenCalledTimes(1);
    expect(info.mock.calls[0]).toEqual(['[summary-email] board b-123: recorded']);
    expect(String(info.mock.calls[0][0])).not.toContain(input.completedAt);
  });

  it('a rejecting dispatch does not reject the callback', async () => {
    let cb: (() => Promise<void>) | undefined;
    mocks.after.mockImplementation((f: () => Promise<void>) => { cb = f; });
    mocks.dispatch.mockRejectedValue(new Error('row for a@b.example'));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    scheduleSummaryEmail(input);
    await expect(cb!()).resolves.toBeUndefined();
    expect(JSON.stringify(err.mock.calls)).not.toContain('a@b.example');
    err.mockRestore();
  });
});
