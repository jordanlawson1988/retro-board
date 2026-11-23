'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ACCOUNT_SETTINGS_LINK,
  UNSUBSCRIBE_API_PATH,
  UNSUBSCRIBE_BODY,
  UNSUBSCRIBE_BUTTON,
  UNSUBSCRIBE_DONE,
  UNSUBSCRIBE_FAILED,
  UNSUBSCRIBE_INVALID,
  UNSUBSCRIBE_TITLE,
} from '@/lib/constants/email';
import { unsubscribeOutcome, type UnsubscribeOutcome } from '@/lib/email-ui';

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]';

/**
 * Props: token, the value of the link's token parameter, or null when there is none.
 * Makes no request until the button is pressed; never verifies or shows the token.
 */
export function UnsubscribeConfirm({ token }: { token: string | null }) {
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<UnsubscribeOutcome | null>(null);
  const inFlight = useRef(false);
  const doneRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (outcome === 'done') doneRef.current?.focus();
  }, [outcome]);

  const press = async () => {
    if (!token || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const res = await fetch(`${UNSUBSCRIBE_API_PATH}?token=${encodeURIComponent(token)}`, { method: 'POST' });
      setOutcome(unsubscribeOutcome(res.status));
    } catch {
      setOutcome('failed');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const invalid = !token || outcome === 'invalid';

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6">
      <div className="bg-[var(--surface)] border border-[var(--line)] rounded-[var(--r-xl)] p-6">
        <h1 className="text-[var(--t-h3)] font-semibold text-[var(--ink)] mb-3">{UNSUBSCRIBE_TITLE}</h1>
        {invalid ? (
          <p role="alert" className="text-[14px] text-[var(--ink-3)]">{UNSUBSCRIBE_INVALID}</p>
        ) : outcome === 'done' ? (
          <>
            <p ref={doneRef} role="status" tabIndex={-1} className={`text-[14px] text-[var(--ink-3)] mb-4 outline-none ${FOCUS}`}>
              {UNSUBSCRIBE_DONE}
            </p>
            <Link
              href="/settings"
              className={`inline-flex items-center min-h-[44px] text-[14px] font-medium text-[var(--accent)] hover:underline ${FOCUS}`}
            >
              {ACCOUNT_SETTINGS_LINK}
            </Link>
          </>
        ) : (
          <>
            <p className="text-[14px] text-[var(--ink-3)] mb-4">{UNSUBSCRIBE_BODY}</p>
            <button
              type="button"
              onClick={press}
              disabled={busy}
              className={`min-h-[44px] px-4 rounded-[var(--r-md)] text-[14px] font-medium bg-[var(--accent)] text-[var(--on-accent)] disabled:opacity-50 disabled:cursor-not-allowed ${FOCUS}`}
            >
              {UNSUBSCRIBE_BUTTON}
            </button>
            {outcome === 'failed' && (
              <p role="alert" className="text-[13px] text-[var(--danger)] mt-3">{UNSUBSCRIBE_FAILED}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
