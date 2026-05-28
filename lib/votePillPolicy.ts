export interface VotePillPolicyInput {
  voteCount: number;
  mode: 'interactive' | 'readonly';
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

export function votePillPolicy(input: VotePillPolicyInput): VotePillPolicyOutput {
  const { voteCount, mode, hasVoted, secretVoting } = input;

  // Readonly (completed boards)
  if (mode === 'readonly') {
    if (voteCount === 0) {
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

  // Interactive (active boards)
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
