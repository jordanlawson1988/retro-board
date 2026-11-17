import { describe, it, expect } from 'vitest';
import { createCoalescedRunner } from '@/lib/coalescedRunner';

function deferred() {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('createCoalescedRunner', () => {
  it('runs immediately when idle', async () => {
    let calls = 0;
    const run = createCoalescedRunner(async () => { calls++; });
    run();
    await tick();
    expect(calls).toBe(1);
  });

  it('never has two in flight and coalesces a burst into one trailing run', async () => {
    const gates = [deferred(), deferred(), deferred()];
    let started = 0;
    let active = 0;
    let maxActive = 0;
    const run = createCoalescedRunner(async () => {
      const g = gates[started++];
      active++; maxActive = Math.max(maxActive, active);
      await g.promise;
      active--;
    });
    run(); run(); run(); run();
    await tick();
    expect(started).toBe(1);
    gates[0].resolve();
    await tick();
    expect(started).toBe(2); // exactly one trailing run for the whole burst
    gates[1].resolve();
    await tick();
    expect(started).toBe(2);
    expect(maxActive).toBe(1);
  });

  it('survives a rejecting task and can run again', async () => {
    let calls = 0;
    const run = createCoalescedRunner(async () => { calls++; if (calls === 1) throw new Error('boom'); });
    run();
    await tick();
    run();
    await tick();
    expect(calls).toBe(2);
  });
});
