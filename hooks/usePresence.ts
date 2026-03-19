'use client';

import { usePresence as useAblyPresence, usePresenceListener } from 'ably/react';
import { useEffect } from 'react';
import { useBoardStore } from '@/stores/boardStore';

interface PresenceData {
  participantId: string;
  displayName: string;
  isAdmin: boolean;
}

export function usePresence(
  boardId: string | undefined,
  participantId: string | null,
  liveSync = true
) {
  const setOnlineParticipantIds = useBoardStore((s) => s.setOnlineParticipantIds);
  const participants = useBoardStore((s) => s.participants);

  const participant = participants.find((p) => p.id === participantId);

  // Enter presence
  useAblyPresence(
    {
      channelName: `retro-board:${boardId}`,
      skip: !boardId || !participantId || !liveSync || !participant,
    },
    {
      participantId,
      displayName: participant?.display_name ?? '',
      isAdmin: participant?.is_admin ?? false,
    } satisfies PresenceData
  );

  // Listen to presence changes
  const { presenceData } = usePresenceListener({
    channelName: `retro-board:${boardId}`,
    skip: !boardId || !liveSync,
  });

  useEffect(() => {
    if (!liveSync) return;
    const ids = presenceData.map((m) => m.clientId);
    setOnlineParticipantIds(ids);
  }, [presenceData, liveSync, setOnlineParticipantIds]);
}
