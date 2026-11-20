import { describe, it, expect, vi } from 'vitest';
import { withJoinCodeRetry, isJoinCodeCollision, JOIN_CODE_MAX_ATTEMPTS } from './join-code-retry';

const dbError = (code: string, constraint?: string) =>
  Object.assign(new Error('db error'), { code, constraint });

describe('isJoinCodeCollision', () => {
  it('matches only 23505 on uq_boards_join_code', () => {
    expect(isJoinCodeCollision(dbError('23505', 'uq_boards_join_code'))).toBe(true);
    expect(isJoinCodeCollision(dbError('23505', 'boards_pkey'))).toBe(false);
    expect(isJoinCodeCollision(dbError('23505'))).toBe(false);
    expect(isJoinCodeCollision(dbError('23514', 'uq_boards_join_code'))).toBe(false);
    expect(isJoinCodeCollision(null)).toBe(false);
    expect(isJoinCodeCollision('x')).toBe(false);
  });
});

describe('withJoinCodeRetry', () => {
  it('retries with a fresh code after collisions, then succeeds', async () => {
    let n = 0;
    const generate = vi.fn(() => `code${n++}`);
    const write = vi.fn(async (code: string) => {
      if (code !== 'code2') throw dbError('23505', 'uq_boards_join_code');
    });
    const result = await withJoinCodeRetry(write, generate);
    expect(result).toBe('code2');
    expect(write).toHaveBeenCalledTimes(3);
  });

  it('gives up after the maximum number of attempts', async () => {
    const write = vi.fn(async () => {
      throw dbError('23505', 'uq_boards_join_code');
    });
    await expect(withJoinCodeRetry(write, () => '12345')).rejects.toThrow();
    expect(write).toHaveBeenCalledTimes(JOIN_CODE_MAX_ATTEMPTS);
    expect(JOIN_CODE_MAX_ATTEMPTS).toBe(10);
  });

  it('rethrows a non-join-code error immediately', async () => {
    const pk = dbError('23505', 'boards_pkey');
    const write = vi.fn(async () => {
      throw pk;
    });
    await expect(withJoinCodeRetry(write, () => '12345')).rejects.toBe(pk);
    expect(write).toHaveBeenCalledTimes(1);
  });
});
