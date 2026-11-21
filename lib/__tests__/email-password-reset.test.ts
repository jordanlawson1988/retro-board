import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock('resend', () => ({
  Resend: vi.fn(function () {
    return { emails: { send: mocks.send } };
  }),
}));

import { sendPasswordResetEmail } from '@/lib/email';

describe('sendPasswordResetEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('RESEND_API_KEY', 'k');
    mocks.send.mockResolvedValue({ data: { id: 'x' }, error: null });
  });

  it('sends exactly this message (production copy, pinned)', async () => {
    await sendPasswordResetEmail('a@example.com', 'https://x/reset');
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.send).toHaveBeenCalledWith({
      from: 'RetroBoard <noreply@retroboard.live>',
      to: 'a@example.com',
      subject: 'Reset your RetroBoard password',
      text: [
        'Someone (hopefully you) asked to reset the password for this RetroBoard account.',
        '',
        `Reset it here: https://x/reset`,
        '',
        "The link expires in 1 hour. If you didn't request this, you can ignore this email — nothing changes.",
      ].join('\n'),
    });
  });
});
