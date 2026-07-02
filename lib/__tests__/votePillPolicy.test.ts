import { describe, it, expect } from 'vitest';
import { votePillPolicy, voteTotalsRevealed } from '@/lib/votePillPolicy';
import type { VotePillPolicyInput } from '@/lib/votePillPolicy';

function input(overrides: Partial<VotePillPolicyInput>): VotePillPolicyInput {
  return {
    voteCount: 0,
    votingEnabled: true,
    isCompleted: false,
    hasVoted: false,
    secretVoting: false,
    ...overrides,
  };
}

describe('votePillPolicy', () => {
  describe('voting on (interactive)', () => {
    it('non-secret, count > 0: pill with count, no popover, interactive', () => {
      const out = votePillPolicy(input({ voteCount: 3 }));
      expect(out.render).toBe('pill');
      expect(out.showCount).toBe(true);
      expect(out.popover).toBe('none');
      expect(out.interactive).toBe(true);
    });

    it('non-secret, count == 0: pill without count, interactive (empty vote button)', () => {
      const out = votePillPolicy(input({ voteCount: 0 }));
      expect(out.render).toBe('pill');
      expect(out.showCount).toBe(false);
      expect(out.popover).toBe('none');
      expect(out.interactive).toBe(true);
    });

    it('secret + hasVoted: voted-badge, no count, no popover, interactive', () => {
      const out = votePillPolicy(input({
        voteCount: 2,
        hasVoted: true,
        secretVoting: true,
      }));
      expect(out.render).toBe('voted-badge');
      expect(out.showCount).toBe(false);
      expect(out.popover).toBe('none');
      expect(out.interactive).toBe(true);
    });

    it('secret + !hasVoted: pill without count, interactive (empty vote button)', () => {
      const out = votePillPolicy(input({
        voteCount: 2,
        hasVoted: false,
        secretVoting: true,
      }));
      expect(out.render).toBe('pill');
      expect(out.showCount).toBe(false);
      expect(out.popover).toBe('none');
      expect(out.interactive).toBe(true);
    });
  });

  describe('voting off, board still active (readonly totals)', () => {
    it('non-secret, count > 0: pill with total, popover shows voters, NOT interactive', () => {
      const out = votePillPolicy(input({ voteCount: 4, votingEnabled: false }));
      expect(out.render).toBe('pill');
      expect(out.showCount).toBe(true);
      expect(out.popover).toBe('voters');
      expect(out.interactive).toBe(false);
    });

    it('non-secret, count == 0: render none (no clutter on unvoted cards)', () => {
      const out = votePillPolicy(input({ voteCount: 0, votingEnabled: false }));
      expect(out.render).toBe('none');
    });

    it('CONTRACT: secret + voting off but NOT completed: render none — secret counts reveal only at completion', () => {
      const out = votePillPolicy(input({
        voteCount: 5,
        votingEnabled: false,
        secretVoting: true,
      }));
      expect(out.render).toBe('none');
    });

    it('secret + voting off + hasVoted: still none (no interaction, counts stay secret)', () => {
      const out = votePillPolicy(input({
        voteCount: 5,
        votingEnabled: false,
        secretVoting: true,
        hasVoted: true,
      }));
      expect(out.render).toBe('none');
    });
  });

  describe('completed board (readonly reveal)', () => {
    it('non-secret, count > 0: pill with count, popover shows voters, NOT interactive', () => {
      const out = votePillPolicy(input({ voteCount: 4, isCompleted: true }));
      expect(out.render).toBe('pill');
      expect(out.showCount).toBe(true);
      expect(out.popover).toBe('voters');
      expect(out.interactive).toBe(false);
    });

    it('completed with voting still enabled: same readonly reveal', () => {
      const out = votePillPolicy(input({ voteCount: 4, isCompleted: true, votingEnabled: true }));
      expect(out.render).toBe('pill');
      expect(out.showCount).toBe(true);
      expect(out.interactive).toBe(false);
    });

    it('non-secret, count == 0: render none', () => {
      const out = votePillPolicy(input({ voteCount: 0, isCompleted: true }));
      expect(out.render).toBe('none');
    });

    it('secret, count > 0: pill with count, NO popover, NOT interactive', () => {
      const out = votePillPolicy(input({
        voteCount: 5,
        isCompleted: true,
        secretVoting: true,
      }));
      expect(out.render).toBe('pill');
      expect(out.showCount).toBe(true);
      expect(out.popover).toBe('none');
      expect(out.interactive).toBe(false);
    });

    it('secret, count == 0: render none', () => {
      const out = votePillPolicy(input({
        voteCount: 0,
        isCompleted: true,
        secretVoting: true,
      }));
      expect(out.render).toBe('none');
    });

    it('CONTRACT: secret-voting + completed reveals counts but hides voter names', () => {
      // Explicit contract test — regression here would silently violate the
      // secret-voting promise documented in the design spec. If this changes,
      // the change is intentional and the spec must be updated first.
      const out = votePillPolicy(input({
        voteCount: 7,
        isCompleted: true,
        secretVoting: true,
      }));
      expect(out.showCount).toBe(true);
      expect(out.popover).toBe('none');
    });
  });

  describe('ariaLabel', () => {
    it('interactive non-voted: "Vote for this card"', () => {
      const out = votePillPolicy(input({ voteCount: 1, hasVoted: false }));
      expect(out.ariaLabel).toBe('Vote for this card');
    });

    it('interactive voted: "Remove vote"', () => {
      const out = votePillPolicy(input({ voteCount: 1, hasVoted: true }));
      expect(out.ariaLabel).toBe('Remove vote');
    });

    it('voting off non-secret: "N votes — hover to see voters" with count', () => {
      const out = votePillPolicy(input({ voteCount: 3, votingEnabled: false }));
      expect(out.ariaLabel).toBe('3 votes — hover to see voters');
    });

    it('completed non-secret single vote: "1 vote — hover to see voters"', () => {
      const out = votePillPolicy(input({ voteCount: 1, isCompleted: true }));
      expect(out.ariaLabel).toBe('1 vote — hover to see voters');
    });

    it('completed secret: "N votes" (no "hover" suffix — there is no tooltip)', () => {
      const out = votePillPolicy(input({
        voteCount: 4, isCompleted: true, secretVoting: true,
      }));
      expect(out.ariaLabel).toBe('4 votes');
    });
  });
});

describe('voteTotalsRevealed', () => {
  it('normal boards: totals are always public', () => {
    expect(voteTotalsRevealed(false, false)).toBe(true);
    expect(voteTotalsRevealed(false, true)).toBe(true);
  });

  it('secret boards: totals hidden until completed', () => {
    expect(voteTotalsRevealed(true, false)).toBe(false);
    expect(voteTotalsRevealed(true, true)).toBe(true);
  });
});
