'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useBoardStore } from '@/stores/boardStore';

interface PresenceState {
  participant_id: string;
  display_name: string;
  is_admin: boolean;
  online_at: string;
}

export function usePresence(boardId: string | undefined, participantId: string | null, liveSync = true) {
  const setOnlineParticipantIds = useBoardStore((s) => s.setOnlineParticipantIds);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!boardId || !participantId || !liveSync) return;

    const participant = useBoardStore.getState().participants.find((p) => p.id === participantId);
    if (!participant) return;

    const channel = supabase.channel(`presence:${boardId}`, {
      config: { presence: { key: participantId } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceState>();
        const ids = Object.keys(state);
        setOnlineParticipantIds(ids);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            participant_id: participantId,
            display_name: participant.display_name,
            is_admin: participant.is_admin,
            online_at: new Date().toISOString(),
          } satisfies PresenceState);
        }
      });

    channelRef.current = channel;

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [boardId, participantId, liveSync, setOnlineParticipantIds]);
}
