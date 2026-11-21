import { after } from 'next/server';
import { dispatchSummaryEmail, type DispatchInput } from '@/lib/summary-email/dispatch';

/**
 * Runs the dispatch after the response is sent. Never throws into the caller: outside a request
 * scope `after` itself throws, and that is swallowed. The log line holds the board id and the
 * outcome word only.
 */
export function scheduleSummaryEmail(input: DispatchInput): void {
  try {
    after(async () => {
      const outcome = await dispatchSummaryEmail(input);
      console.info('[summary-email] board ' + input.boardId + ': ' + outcome);
    });
  } catch {
    // No request scope (a unit test, a script): nothing to schedule.
  }
}
