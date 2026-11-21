import { notFound } from 'next/navigation';
import { SummaryPage } from '@/components/Summary';
import { SUMMARY_PAGE_TITLE } from '@/lib/constants/summary';
import { guidedBoardExists } from '@/lib/summary-route';

export const dynamic = 'force-dynamic';

export const metadata = { title: SUMMARY_PAGE_TITLE, robots: { index: false, follow: false } };

/**
 * A thin server page. The only thing it decides is "does this guided board exist": a real 404 status
 * for anything else, rendered by app/not-found.tsx exactly like an unknown URL. Content and who may
 * see it come from the board GET, called by the client component.
 */
export default async function SummaryRoute({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  if (!(await guidedBoardExists(boardId))) notFound();
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <SummaryPage boardId={boardId} />
    </div>
  );
}
