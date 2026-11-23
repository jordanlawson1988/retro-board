'use client';

import { usePresence as useAblyPresence, usePresenceListener } from 'ably/react';
import { useEffect, useRef } from 'react';
import { useBoardStore } from '@/stores/boardStore';
import { usePhaseStore, currentReadyPhase } from '@/stores/phaseStore';
import { readySummary } from '@/lib/phases';
import type { PhaseId } from '@/lib/constants/phases';

interface PresenceData {
  participantId: string;
  displayName: string;
  isAdmin: boolean;
  /** The phase this participant is ready for, or null. Only counts for the board's current phase. */
  readyPhase: PhaseId | null;
}

export function usePresence(
  boardId: string | undefined,
  participantId: string | null,
  liveSync = true
) {
  const setOnlineParticipantIds = useBoardStore((s) => s.setOnlineParticipantIds);
  const participants = useBoardStore((s) => s.participants);

  const phase = useBoardStore((s) => s.board?.phase ?? null);
  const boardKey = useBoardStore((s) => s.board?.id ?? null);
  const iAmReadyFor = usePhaseStore((s) => s.iAmReadyFor);
  const readyBoardId = usePhaseStore((s) => s.readyBoardId);
  const setReadySummary = usePhaseStore((s) => s.setReadySummary);

  const participant = participants.find((p) => p.id === participantId);
  const readyPhase = currentReadyPhase({ iAmReadyFor, readyBoardId }, boardKey ? { id: boardKey, phase } : null);

  const presenceData = {
    participantId: participantId!,
    displayName: participant?.display_name ?? '',
    isAdmin: participant?.is_admin ?? false,
    readyPhase,
  } satisfies PresenceData;
  const skipPresence = !boardId || !participantId || !liveSync || !participant;

  // Enter presence
  const { updateStatus } = useAblyPresence(
    { channelName: `retro-board:${boardId}`, skip: skipPresence },
    presenceData
  );

  // Push a ready change to everyone else (the hook only sends the data it entered with).
  const lastReady = useRef<PhaseId | null>(readyPhase);
  useEffect(() => {
    if (skipPresence || lastReady.current === readyPhase) return;
    lastReady.current = readyPhase;
    void updateStatus(presenceData).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyPhase, skipPresence]);

  // Listen to presence changes
  const { presenceData: members } = usePresenceListener({
    channelName: `retro-board:${boardId}`,
    skip: !boardId || !liveSync,
  });

  useEffect(() => {
    if (!liveSync) return;
    const ids = members.map((m) => m.clientId);
    setOnlineParticipantIds(ids);
    if (phase) setReadySummary(readySummary(members, phase));
  }, [members, liveSync, setOnlineParticipantIds, phase, setReadySummary]);
}
