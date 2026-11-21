'use client';

import { useTeamVotesLeft } from '@/hooks/useTeamVotesLeft';
import { teamVotesLabel } from '@/lib/votes';

/** The team's votes left, beside the personal vote status in the desktop header. */
export function TeamVotesLeft() {
  const left = useTeamVotesLeft();
  if (left === null) return null;
  return (
    <span data-testid="team-votes-left" className="whitespace-nowrap text-sm text-[var(--ink-2)] tnum">
      {teamVotesLabel(left)}
    </span>
  );
}
