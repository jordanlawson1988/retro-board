import { ablyServer } from '@/lib/ably-server';
import { NextRequest } from 'next/server';
import { loadBoardActor } from '@/lib/board-actor';
import { boardAccessFrom } from '@/lib/board-access-loader';
import { BOARD_ACCESS, BOARD_COMPLETED_ERROR } from '@/lib/constants/board-access';

// Mints a token usable ONLY on the requested board's two channels.
// Anonymous access is by design (participants have no accounts); the
// scoping is what prevents cross-board realtime snooping/forgery.
export async function GET(request: NextRequest) {
  const queryClientId = request.nextUrl.searchParams.get('clientId');
  const boardId = request.nextUrl.searchParams.get('boardId');
  if (!boardId) {
    return new Response('Missing boardId', { status: 400 });
  }

  const loaded = await loadBoardActor(request, boardId, null, { claimedParticipantId: queryClientId });
  if (!loaded) {
    return new Response('Unknown board', { status: 404 });
  }

  // v2: the client id is the signed session's participant; the query value is ignored.
  // v1: the query clientId is still used.
  let clientId: string;
  if (loaded.board.trust_version === 2) {
    if (!loaded.actor.participantId) {
      return new Response('Join the board first', { status: 401 });
    }
    clientId = loaded.actor.participantId;
  } else {
    if (!queryClientId) return new Response('Missing clientId', { status: 400 });
    clientId = queryClientId;
  }

  // A completed board follows the same allowed-viewer rule as the board GET. On v1 the
  // claimed clientId is the identity (best effort, see lib/board-access.ts).
  if (loaded.board.archived_at) {
    const decision = boardAccessFrom(loaded);
    if (decision.access === BOARD_ACCESS[1]) {
      return new Response(BOARD_COMPLETED_ERROR, { status: 403 });
    }
  }

  const tokenRequest = await ablyServer.auth.createTokenRequest({
    clientId,
    capability: JSON.stringify({
      // Clients never publish on the main channel; the server publishes shaped events.
      [`retro-board:${boardId}`]: ['subscribe', 'presence'],
      [`retro-board:${boardId}:timer`]: ['subscribe', 'publish', 'presence'],
    }),
  });

  return Response.json(tokenRequest);
}
