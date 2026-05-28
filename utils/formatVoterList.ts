import type { Participant } from '@/types';
import { MAX_PEOPLE_NAMES } from '@/utils/constants';

export interface VoterEntry {
  id: string;
  name: string;     // display_name or "Someone"
  isMine: boolean;
}

export interface FormattedVoters {
  entries: VoterEntry[];   // capped at MAX_PEOPLE_NAMES
  overflow: number;        // count of names beyond the cap
}

export function formatVoterList(
  voterIds: string[],
  participants: Participant[],
  currentParticipantId: string | null,
): FormattedVoters {
  const byId = new Map(participants.map((p) => [p.id, p.display_name]));
  const visible = voterIds.slice(0, MAX_PEOPLE_NAMES);
  const overflow = Math.max(0, voterIds.length - MAX_PEOPLE_NAMES);

  const entries: VoterEntry[] = visible.map((id) => ({
    id,
    name: byId.get(id) ?? 'Someone',
    isMine: id === currentParticipantId,
  }));

  return { entries, overflow };
}
