export interface VotePillPolicyInput {
  voteCount: number;
  votingEnabled: boolean;
  isCompleted: boolean;
  hasVoted: boolean;
  secretVoting: boolean;
}

export interface VotePillPolicyOutput {
  /** Top-level: what to render. */
  render: 'pill' | 'voted-badge' | 'none';
  /** Whether the numeric count is visible on the pill. */
  showCount: boolean;
  /** Whether hover/tap opens a popover with voter names. */
  popover: 'voters' | 'none';
  /** Whether the pill is an active vote-toggle button. */
  interactive: boolean;
  /** aria-label string for the rendered element. Empty string when `render === 'none'` — callers should check `render` before applying this. */
  ariaLabel: string;
}

/**
 * Aggregate vote totals (per-card pills, column/lane badges) are public unless
 * the board uses secret voting and hasn't been completed yet — secret counts
 * reveal only at completion.
 */
export function voteTotalsRevealed(secretVoting: boolean, isCompleted: boolean): boolean {
  return !secretVoting || isCompleted;
}

export function votePillPolicy(input: VotePillPolicyInput): VotePillPolicyOutput {
  const { voteCount, votingEnabled, isCompleted, hasVoted, secretVoting } = input;

  // Readonly: completed boards, or voting turned off mid-retro (totals stay visible)
  if (isCompleted || !votingEnabled) {
    if (voteCount === 0 || !voteTotalsRevealed(secretVoting, isCompleted)) {
      return {
        render: 'none',
        showCount: false,
        popover: 'none',
        interactive: false,
        ariaLabel: '',
      };
    }
    const noun = voteCount === 1 ? 'vote' : 'votes';
    if (secretVoting) {
      return {
        render: 'pill',
        showCount: true,
        popover: 'none',
        interactive: false,
        ariaLabel: `${voteCount} ${noun}`,
      };
    }
    return {
      render: 'pill',
      showCount: true,
      popover: 'voters',
      interactive: false,
      ariaLabel: `${voteCount} ${noun} — hover to see voters`,
    };
  }

  // Interactive (voting on, board active)
  if (secretVoting && hasVoted) {
    return {
      render: 'voted-badge',
      showCount: false,
      popover: 'none',
      interactive: true,
      ariaLabel: 'Remove vote',
    };
  }

  return {
    render: 'pill',
    showCount: !secretVoting && voteCount > 0,
    popover: 'none',
    interactive: true,
    ariaLabel: hasVoted ? 'Remove vote' : 'Vote for this card',
  };
}
