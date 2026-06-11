export const metadata = { title: 'Privacy Policy — RetroBoard' };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 text-[var(--ink-2)]">
      <h1 className="text-2xl font-bold text-[var(--ink)]">Privacy Policy</h1>
      <p className="mt-1 text-sm text-[var(--ink-3)]">Last updated: June 2026</p>

      <h2 className="mt-8 text-lg font-semibold text-[var(--ink)]">What we store</h2>
      <p className="mt-2 text-sm leading-6">
        Account holders: email, display name, and a hashed password (via Better
        Auth). Participants: the display name you type when joining a board and the
        cards, votes, and reactions you create. Board content is free text — don&apos;t
        post anything you wouldn&apos;t want the rest of your board to see. We do not
        sell data or run third-party advertising.
      </p>

      <h2 className="mt-6 text-lg font-semibold text-[var(--ink)]">Payments</h2>
      <p className="mt-2 text-sm leading-6">
        Payments are processed by Paddle.com as merchant of record. We never see or
        store card numbers; Paddle shares your email and subscription status with us.
      </p>

      <h2 className="mt-6 text-lg font-semibold text-[var(--ink)]">Processors</h2>
      <p className="mt-2 text-sm leading-6">
        Vercel (hosting), Neon (database), Ably (realtime messaging), Cloudflare
        Turnstile (anti-bot), Paddle (payments), Resend (transactional email).
      </p>

      <h2 className="mt-6 text-lg font-semibold text-[var(--ink)]">Retention & deletion</h2>
      <p className="mt-2 text-sm leading-6">
        Boards you delete go to Trash and are permanently purged after 30 days.
        Deleting your account removes your login; to also erase board content you
        authored, email{' '}
        <a href="mailto:support@retroboard.live" className="text-[var(--accent)]">
          support@retroboard.live
        </a>{' '}
        and we will scrub it within 30 days. You can export your boards (Markdown/CSV)
        at any time.
      </p>

      <h2 className="mt-6 text-lg font-semibold text-[var(--ink)]">Cookies</h2>
      <p className="mt-2 text-sm leading-6">
        We use a session cookie for signed-in accounts and browser storage for
        anonymous participant identity. No tracking cookies.
      </p>

      <h2 className="mt-6 text-lg font-semibold text-[var(--ink)]">Contact</h2>
      <p className="mt-2 text-sm leading-6">
        Data questions or erasure requests:{' '}
        <a href="mailto:support@retroboard.live" className="text-[var(--accent)]">
          support@retroboard.live
        </a>
      </p>
    </main>
  );
}
