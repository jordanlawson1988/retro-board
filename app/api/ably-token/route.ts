import { ablyServer } from '@/lib/ably-server';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get('clientId');
  if (!clientId) {
    return new Response('Missing clientId', { status: 400 });
  }

  const tokenRequest = await ablyServer.auth.createTokenRequest({
    clientId,
  });

  return Response.json(tokenRequest);
}
