'use client';

import { AblyProvider as AblyReactProvider } from 'ably/react';
import * as Ably from 'ably';
import { useRef } from 'react';

export function AblyProvider({
  clientId,
  boardId,
  children,
}: {
  clientId: string;
  boardId: string;
  children: React.ReactNode;
}) {
  const clientRef = useRef<Ably.Realtime | null>(null);

  if (!clientRef.current) {
    clientRef.current = new Ably.Realtime({
      authUrl: `/api/ably-token?clientId=${clientId}&boardId=${boardId}`,
      authMethod: 'GET',
      clientId,
    });
  }

  return (
    <AblyReactProvider client={clientRef.current}>
      {children}
    </AblyReactProvider>
  );
}
