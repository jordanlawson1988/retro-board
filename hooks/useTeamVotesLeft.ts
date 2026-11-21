'use client';

import { useBoardStore } from '@/stores/boardStore';
import { GUIDED_MODE } from '@/lib/constants/phases';
import { teamVotesLeftFor } from '@/lib/votes';

/**
 * The team's votes left, or null when there is nothing to show. One selector that returns a
 * number or null, so a component re-renders only when the number itself changes. An open board
 * answers null before `participants` or the tally are read.
 */
export function useTeamVotesLeft(): number | null {
  return useBoardStore((s) =>
    s.board?.mode !== GUIDED_MODE ? null : teamVotesLeftFor(s.board, s.participants.length, s.voteTally),
  );
}
