import { BoardPageWrapper } from '@/components/pages/BoardPageWrapper';

export default async function BoardRoute({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const { boardId } = await params;
  return <BoardPageWrapper boardId={boardId} />;
}
