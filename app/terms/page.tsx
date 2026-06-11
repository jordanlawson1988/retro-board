export const metadata = { title: 'Terms of Service — RetroBoard' };

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 text-[var(--ink-2)]">
      <h1 className="text-2xl font-bold text-[var(--ink)]">Terms of Service</h1>
      <p className="mt-1 text-sm text-[var(--ink-3)]">Last updated: June 2026</p>

      <h2 className="mt-8 text-lg font-semibold text-[var(--ink)]">The service</h2>
      <p className="mt-2 text-sm leading-6">
        RetroBoard (retroboard.live) is a real-time retrospective board operated by a
        single developer. Participants may join boards anonymously without an account.
        Creating boards requires an account; unlimited boards require a paid
        subscription ($3.99/month) processed by Paddle.com, our merchant of record.
      </p>

      <h2 className="mt-6 text-lg font-semibold text-[var(--ink)]">Subscriptions & refunds</h2>
      <p className="mt-2 text-sm leading-6">
        Subscriptions renew monthly and can be cancelled anytime from the billing
        portal; access continues to the end of the paid period. If a subscription
        lapses, boards beyond the free plan&apos;s limit become read-only after a 14-day
        grace period — board content is never deleted because of a lapse. Unhappy?
        Email us within 14 days of any charge for a full refund, no questions asked.
        See the full <a href="/refunds" className="text-[var(--accent)]">Refund Policy</a>.
      </p>

      <h2 className="mt-6 text-lg font-semibold text-[var(--ink)]">Acceptable use</h2>
      <p className="mt-2 text-sm leading-6">
        Don&apos;t use RetroBoard to post unlawful, harassing, or malicious content, to
        spam, or to probe or disrupt the service. Boards are user-generated content;
        we may remove content or boards that violate these terms and may suspend
        accounts used for abuse. Report abusive content to{' '}
        <a href="mailto:support@retroboard.live" className="text-[var(--accent)]">
          support@retroboard.live
        </a>.
      </p>

      <h2 className="mt-6 text-lg font-semibold text-[var(--ink)]">Your data</h2>
      <p className="mt-2 text-sm leading-6">
        You own your board content. You can export boards (Markdown/CSV) and delete
        boards at any time; deleted boards are purged within 30 days. See the{' '}
        <a href="/privacy" className="text-[var(--accent)]">Privacy Policy</a> for
        what we store and how to erase it.
      </p>

      <h2 className="mt-6 text-lg font-semibold text-[var(--ink)]">Liability</h2>
      <p className="mt-2 text-sm leading-6">
        The service is provided &quot;as is&quot; without warranties. To the maximum extent
        permitted by law, our total liability for any claim is limited to the amount
        you paid in the three months before the claim.
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
