export const metadata = { title: 'Refund Policy — RetroBoard' };

export default function RefundsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 text-[var(--ink-2)]">
      <h1 className="text-2xl font-bold text-[var(--ink)]">Refund Policy</h1>
      <p className="mt-1 text-sm text-[var(--ink-3)]">Last updated: June 2026</p>

      <h2 className="mt-8 text-lg font-semibold text-[var(--ink)]">The short version</h2>
      <p className="mt-2 text-sm leading-6">
        If you&apos;re unhappy with RetroBoard Pro for any reason, email{' '}
        <a href="mailto:support@retroboard.live" className="text-[var(--accent)]">
          support@retroboard.live
        </a>{' '}
        within 14 days of any charge and we&apos;ll refund it in full — no questions
        asked.
      </p>

      <h2 className="mt-6 text-lg font-semibold text-[var(--ink)]">How billing works</h2>
      <p className="mt-2 text-sm leading-6">
        RetroBoard Pro is $3.99/month, billed by Paddle.com as our merchant of
        record. Subscriptions renew monthly until cancelled. You can cancel anytime
        from the billing portal; your subscription stays active until the end of the
        period you&apos;ve already paid for, and you won&apos;t be charged again.
      </p>

      <h2 className="mt-6 text-lg font-semibold text-[var(--ink)]">How refunds work</h2>
      <p className="mt-2 text-sm leading-6">
        Send your request from the email address on the subscription (or include
        your Paddle receipt number). Refunds are issued by Paddle to your original
        payment method and typically arrive within 5–10 business days, depending on
        your bank.
      </p>

      <h2 className="mt-6 text-lg font-semibold text-[var(--ink)]">What happens to your boards</h2>
      <p className="mt-2 text-sm leading-6">
        If your subscription ends or lapses, boards beyond the free plan&apos;s limit
        become read-only after a 14-day grace period. Your board content is never
        deleted because a subscription ended — you can export it (Markdown/CSV) at
        any time.
      </p>

      <h2 className="mt-6 text-lg font-semibold text-[var(--ink)]">Statutory rights</h2>
      <p className="mt-2 text-sm leading-6">
        Nothing in this policy limits any non-waivable statutory rights you have as
        a consumer in your country of residence.
      </p>

      <h2 className="mt-6 text-lg font-semibold text-[var(--ink)]">Contact</h2>
      <p className="mt-2 text-sm leading-6">
        <a href="mailto:support@retroboard.live" className="text-[var(--accent)]">
          support@retroboard.live
        </a>
      </p>
    </main>
  );
}
