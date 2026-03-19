'use client';

import { AblyProvider } from '@/components/providers/AblyProvider';
import { BoardPage } from '@/components/pages/BoardPage';
import { useBoardStore } from '@/stores/boardStore';
import { useBoardChannel } from '@/hooks/useBoardChannel';
import { usePresence } from '@/hooks/usePresence';
import { ChannelProvider } from 'ably/react';

export function BoardPageWrapper({ boardId }: { boardId: string }) {
  const currentParticipantId = useBoardStore((s) => s.currentParticipantId);

  // If no participant yet (join modal showing), render without Ably
  if (!currentParticipantId) {
    return <BoardPage boardId={boardId} />;
  }

  return (
    <AblyProvider clientId={currentParticipantId}>
      <ChannelProvider channelName={`retro-board:${boardId}`}>
        <ChannelProvider channelName={`retro-board:${boardId}:timer`}>
          <BoardPageInner boardId={boardId} />
        </ChannelProvider>
      </ChannelProvider>
    </AblyProvider>
  );
}

function BoardPageInner({ boardId }: { boardId: string }) {
  const currentParticipantId = useBoardStore((s) => s.currentParticipantId);

  // Set up realtime subscriptions
  useBoardChannel(boardId);
  usePresence(boardId, currentParticipantId);

  return <BoardPage boardId={boardId} />;
}
