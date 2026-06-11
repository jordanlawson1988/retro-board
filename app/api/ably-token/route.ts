import { ablyServer } from '@/lib/ably-server';
import { sql } from '@/lib/db';
import { NextRequest } from 'next/server';

// Mints a token usable ONLY on the requested board's two channels.
// Anonymous access is by design (participants have no accounts); the
// scoping is what prevents cross-board realtime snooping/forgery.
export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get('clientId');
  const boardId = request.nextUrl.searchParams.get('boardId');
  if (!clientId || !boardId) {
    return new Response('Missing clientId or boardId', { status: 400 });
  }

  const [board] = await sql`
    SELECT 1 AS ok FROM boards WHERE id = ${boardId} AND deleted_at IS NULL
  `;
  if (!board) {
    return new Response('Unknown board', { status: 404 });
  }

  const tokenRequest = await ablyServer.auth.createTokenRequest({
    clientId,
    capability: JSON.stringify({
      [`retro-board:${boardId}`]: ['subscribe', 'publish', 'presence'],
      [`retro-board:${boardId}:timer`]: ['subscribe', 'publish', 'presence'],
    }),
  });

  return Response.json(tokenRequest);
}
