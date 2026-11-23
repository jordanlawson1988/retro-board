import { useBoardStore, failWrite, refetchBoardCoalesced } from '@/stores/boardStore';
import { errorMessageOf } from '@/lib/votes';

const onBoard = (boardId: string) => useBoardStore.getState().board?.id === boardId;

/**
 * The error a failed write rejects with. While the board is still the current one it goes through
 * failWrite (message, banner, 401 handling, phase refetch on 409), and a 5xx or unanswered request,
 * which the server may have saved anyway, also pulls the real state back through the coalesced
 * refetch (`refetch: false` leaves that to the caller). For a board the user has left it applies
 * NOTHING: the error only carries the server's message.
 */
export async function failAction(
  res: Response | null,
  fallback: string,
  boardId: string,
  opts: { refetch: boolean } = { refetch: true },
): Promise<Error> {
  if (!onBoard(boardId)) {
    const data = res ? await res.json().catch(() => null) : null;
    return new Error(errorMessageOf(data, fallback));
  }
  const err = await failWrite(res ?? noAnswer(), fallback);
  if (opts.refetch && (!res || res.status >= 500) && onBoard(boardId)) await refetchBoardCoalesced(boardId);
  return err;
}

export const noAnswer = () => new Response(null, { status: 500 });
