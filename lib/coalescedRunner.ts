/**
 * Wrap an async task so at most one run is in flight. Calls that arrive while a run is
 * in flight collapse into a single trailing run (the in-flight one may have read state
 * from before the caller's event, so a follow-up is required, but more than one is not).
 * Task errors are swallowed so a failed run never blocks later ones.
 */
export function createCoalescedRunner(task: () => Promise<unknown>): () => void {
  let running = false;
  let again = false;

  const run = (): void => {
    if (running) {
      again = true;
      return;
    }
    running = true;
    void (async () => {
      try {
        await task();
      } catch {
        // A failed refetch is retried by the next trigger.
      } finally {
        running = false;
        if (again) {
          again = false;
          run();
        }
      }
    })();
  };
  return run;
}

/**
 * Per-key coalescing for a board refetch. For one key at most one run is in flight; triggers
 * that arrive meanwhile share ONE trailing run, which starts after the current one ends, so
 * the last run always starts after the last trigger. The returned promise resolves (never
 * rejects) when a run that started after the call has finished.
 */
export function createKeyedCoalescer(task: (key: string) => Promise<unknown>): (key: string) => Promise<void> {
  interface Slot {
    running: boolean;
    queued: { promise: Promise<void>; resolve: () => void } | null;
  }
  const slots = new Map<string, Slot>();

  const start = (key: string, slot: Slot): Promise<void> => {
    slot.running = true;
    return (async () => {
      try {
        await task(key);
      } catch {
        // A failed refetch is retried by the next trigger.
      } finally {
        slot.running = false;
        const queued = slot.queued;
        slot.queued = null;
        if (queued) void start(key, slot).then(queued.resolve);
      }
    })();
  };

  return (key) => {
    let slot = slots.get(key);
    if (!slot) {
      slot = { running: false, queued: null };
      slots.set(key, slot);
    }
    if (!slot.running) return start(key, slot);
    if (!slot.queued) {
      let resolve!: () => void;
      const promise = new Promise<void>((r) => { resolve = r; });
      slot.queued = { promise, resolve };
    }
    return slot.queued.promise;
  };
}
