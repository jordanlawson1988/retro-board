import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--line)] px-4 py-8">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-[var(--ink-4)]">
        <span>© {new Date().getFullYear()} RetroBoard</span>
        <Link href="/terms" className="hover:text-[var(--ink-2)]">Terms</Link>
        <Link href="/privacy" className="hover:text-[var(--ink-2)]">Privacy</Link>
        <Link href="/refunds" className="hover:text-[var(--ink-2)]">Refunds</Link>
        <a href="mailto:support@retroboard.live" className="hover:text-[var(--ink-2)]">Support</a>
        <a href="mailto:support@retroboard.live?subject=Abuse%20report" className="hover:text-[var(--ink-2)]">Report abuse</a>
      </div>
    </footer>
  );
}
