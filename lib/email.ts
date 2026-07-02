// Lazy init, same pattern as lib/db.ts — never crash the build without env.
import { Resend } from 'resend';

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

export async function sendPasswordResetEmail(to: string, url: string) {
  await getResend().emails.send({
    from: 'RetroBoard <noreply@retroboard.live>',
    to,
    subject: 'Reset your RetroBoard password',
    text: [
      'Someone (hopefully you) asked to reset the password for this RetroBoard account.',
      '',
      `Reset it here: ${url}`,
      '',
      "The link expires in 1 hour. If you didn't request this, you can ignore this email — nothing changes.",
    ].join('\n'),
  });
}
