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
