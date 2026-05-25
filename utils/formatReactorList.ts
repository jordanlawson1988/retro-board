import type { Participant } from '@/types';

export interface ReactorEntry {
  id: string;
  name: string;     // display_name or "Someone"
  isMine: boolean;
}

export interface FormattedReactors {
  entries: ReactorEntry[];   // capped at MAX_REACTOR_NAMES
  overflow: number;          // count of names beyond the cap
}

export const MAX_REACTOR_NAMES = 8;

export function formatReactorList(
  reactorIds: string[],
  participants: Participant[],
  currentParticipantId: string | null,
): FormattedReactors {
  const byId = new Map(participants.map((p) => [p.id, p.display_name]));
  const visible = reactorIds.slice(0, MAX_REACTOR_NAMES);
  const overflow = Math.max(0, reactorIds.length - MAX_REACTOR_NAMES);

  const entries: ReactorEntry[] = visible.map((id) => ({
    id,
    name: byId.get(id) ?? 'Someone',
    isMine: id === currentParticipantId,
  }));

  return { entries, overflow };
}
