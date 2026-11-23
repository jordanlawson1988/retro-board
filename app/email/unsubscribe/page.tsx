import { AppShell } from '@/components/Layout';
import { UnsubscribeConfirm } from '@/components/Email/UnsubscribeConfirm';
import { UNSUBSCRIBE_TITLE } from '@/lib/constants/email';
import { tokenFromSearchParam } from '@/lib/email-ui';

export const metadata = { title: UNSUBSCRIBE_TITLE, robots: { index: false, follow: false } };

// No database call and no token check here: verifying on load would tell a visitor, or a mail
// scanner, whether a token is real. The button's POST decides.
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams;
  return (
    <AppShell>
      <UnsubscribeConfirm token={tokenFromSearchParam(token)} />
    </AppShell>
  );
}
