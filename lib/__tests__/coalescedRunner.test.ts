import { describe, it, expect } from 'vitest';
import { createCoalescedRunner, createKeyedCoalescer } from '@/lib/coalescedRunner';

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

describe('createKeyedCoalescer', () => {
  it('two triggers while one is in flight make exactly two sequential fetches', async () => {
    const gates = [deferred(), deferred(), deferred()];
    let started = 0;
    let active = 0;
    let maxActive = 0;
    const trigger = createKeyedCoalescer(async () => {
      const g = gates[started++];
      active++; maxActive = Math.max(maxActive, active);
      await g.promise;
      active--;
    });
    const first = trigger('b1');
    const second = trigger('b1');
    const third = trigger('b1');
    await tick();
    expect(started).toBe(1);
    gates[0].resolve();
    await first;
    await tick();
    expect(started).toBe(2); // one trailing run for both late triggers
    gates[1].resolve();
    await Promise.all([second, third]);
    expect(started).toBe(2);
    expect(maxActive).toBe(1);
  });

  it('a late trigger resolves only after a run that started after it', async () => {
    const gates = [deferred(), deferred()];
    let started = 0;
    const trigger = createKeyedCoalescer(async () => { await gates[started++].promise; });
    void trigger('b1');
    let lateDone = false;
    void trigger('b1').then(() => { lateDone = true; });
    gates[0].resolve();
    await tick();
    expect(lateDone).toBe(false);
    gates[1].resolve();
    await tick();
    expect(lateDone).toBe(true);
  });

  it('a trigger after everything settled fetches again', async () => {
    let calls = 0;
    const trigger = createKeyedCoalescer(async () => { calls++; });
    await trigger('b1');
    await trigger('b1');
    expect(calls).toBe(2);
  });

  it('a rejected fetch does not wedge the runner and the promise still resolves', async () => {
    let calls = 0;
    const trigger = createKeyedCoalescer(async () => { calls++; if (calls === 1) throw new Error('boom'); });
    await expect(trigger('b1')).resolves.toBeUndefined();
    await trigger('b1');
    expect(calls).toBe(2);
  });

  it('keys do not block each other', async () => {
    const seen: string[] = [];
    const gate = deferred();
    const trigger = createKeyedCoalescer(async (key) => { seen.push(key); if (key === 'a') await gate.promise; });
    void trigger('a');
    await trigger('b');
    expect(seen).toEqual(['a', 'b']);
    gate.resolve();
  });
});
