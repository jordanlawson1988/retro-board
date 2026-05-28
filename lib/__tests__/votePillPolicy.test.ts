import { describe, it, expect } from 'vitest';
import { votePillPolicy } from '@/lib/votePillPolicy';
import type { VotePillPolicyInput } from '@/lib/votePillPolicy';

function input(overrides: Partial<VotePillPolicyInput>): VotePillPolicyInput {
  return {
    voteCount: 0,
    mode: 'interactive',
    hasVoted: false,
    secretVoting: false,
    isCompleted: false,
    ...overrides,
  };
}

describe('votePillPolicy', () => {
  describe('active board (interactive mode)', () => {
    it('non-secret, count > 0: pill with count, no popover, interactive', () => {
      const out = votePillPolicy(input({ voteCount: 3, mode: 'interactive' }));
      expect(out.render).toBe('pill');
      expect(out.showCount).toBe(true);
      expect(out.popover).toBe('none');
      expect(out.interactive).toBe(true);
    });

    it('non-secret, count == 0: pill without count, interactive (empty vote button)', () => {
      const out = votePillPolicy(input({ voteCount: 0, mode: 'interactive' }));
      expect(out.render).toBe('pill');
      expect(out.showCount).toBe(false);
      expect(out.popover).toBe('none');
      expect(out.interactive).toBe(true);
    });

    it('secret + hasVoted: voted-badge, no count, no popover, interactive', () => {
      const out = votePillPolicy(input({
        voteCount: 2,
        mode: 'interactive',
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
        mode: 'interactive',
        hasVoted: false,
        secretVoting: true,
      }));
      expect(out.render).toBe('pill');
      expect(out.showCount).toBe(false);
      expect(out.popover).toBe('none');
      expect(out.interactive).toBe(true);
    });
  });

  describe('completed board (readonly mode)', () => {
    it('non-secret, count > 0: pill with count, popover shows voters, NOT interactive', () => {
      const out = votePillPolicy(input({
        voteCount: 4,
        mode: 'readonly',
        isCompleted: true,
      }));
      expect(out.render).toBe('pill');
      expect(out.showCount).toBe(true);
      expect(out.popover).toBe('voters');
      expect(out.interactive).toBe(false);
    });

    it('non-secret, count == 0: render none', () => {
      const out = votePillPolicy(input({
        voteCount: 0,
        mode: 'readonly',
        isCompleted: true,
      }));
      expect(out.render).toBe('none');
    });

    it('secret, count > 0: pill with count, NO popover, NOT interactive', () => {
      const out = votePillPolicy(input({
        voteCount: 5,
        mode: 'readonly',
        secretVoting: true,
        isCompleted: true,
      }));
      expect(out.render).toBe('pill');
      expect(out.showCount).toBe(true);
      expect(out.popover).toBe('none');
      expect(out.interactive).toBe(false);
    });

    it('secret, count == 0: render none', () => {
      const out = votePillPolicy(input({
        voteCount: 0,
        mode: 'readonly',
        secretVoting: true,
        isCompleted: true,
      }));
      expect(out.render).toBe('none');
    });
  });

  it('CONTRACT: secret-voting + completed reveals counts but hides voter names', () => {
    // Explicit contract test — regression here would silently violate the
    // secret-voting promise documented in the design spec. If this changes,
    // the change is intentional and the spec must be updated first.
    const out = votePillPolicy(input({
      voteCount: 7,
      mode: 'readonly',
      secretVoting: true,
      isCompleted: true,
    }));
    expect(out.showCount).toBe(true);
    expect(out.popover).toBe('none');
  });

  describe('ariaLabel', () => {
    it('interactive non-voted: "Vote for this card"', () => {
      const out = votePillPolicy(input({ voteCount: 1, mode: 'interactive', hasVoted: false }));
      expect(out.ariaLabel).toBe('Vote for this card');
    });

    it('interactive voted: "Remove vote"', () => {
      const out = votePillPolicy(input({ voteCount: 1, mode: 'interactive', hasVoted: true }));
      expect(out.ariaLabel).toBe('Remove vote');
    });

    it('readonly non-secret: "N votes — hover to see voters" with count', () => {
      const out = votePillPolicy(input({ voteCount: 3, mode: 'readonly', isCompleted: true }));
      expect(out.ariaLabel).toBe('3 votes — hover to see voters');
    });

    it('readonly non-secret single vote: "1 vote — hover to see voters"', () => {
      const out = votePillPolicy(input({ voteCount: 1, mode: 'readonly', isCompleted: true }));
      expect(out.ariaLabel).toBe('1 vote — hover to see voters');
    });

    it('readonly secret: "N votes" (no "hover" suffix — there is no tooltip)', () => {
      const out = votePillPolicy(input({
        voteCount: 4, mode: 'readonly', secretVoting: true, isCompleted: true,
      }));
      expect(out.ariaLabel).toBe('4 votes');
    });
  });
});
