import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { SUMMARY_SEND_STATUSES, EMAIL_KINDS, SEND_ERROR_MAX } from '@/lib/constants/email';
import { SUMMARY_EMAIL_FEATURE } from '@/lib/constants/features';

const sqlText = readFileSync('scripts/migrations/018_wrap_up.sql', 'utf-8');
const inList = (re: RegExp) => [...(re.exec(sqlText)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]);

describe('018_wrap_up.sql contract', () => {
  it('status and kind checks equal the constants, in order', () => {
    expect(inList(/summary_email_sends_status_check CHECK \(status IN \(([^)]*)\)\)/)).toEqual([...SUMMARY_SEND_STATUSES]);
    expect(inList(/email_outbox_kind_check CHECK \(kind IN \(([^)]*)\)\)/)).toEqual([...EMAIL_KINDS]);
    expect(Number(/char_length\(error\) <= (\d+)/.exec(sqlText)?.[1])).toBe(SEND_ERROR_MAX);
  });
  it('one send per board, completion and person; preferences and sends go with the account', () => {
    expect(sqlText).toMatch(/PRIMARY KEY \(board_id, completed_at, user_id\)/);
    expect(sqlText.match(/REFERENCES "user" \(id\) ON DELETE CASCADE/g)).toHaveLength(2);
    expect(sqlText.match(/REFERENCES boards \(id\) ON DELETE CASCADE/g)).toHaveLength(2);
  });
  it('the flag row is inserted off, under the constant key, guarded', () => {
    expect(sqlText).toContain(`SELECT '${SUMMARY_EMAIL_FEATURE}', 'Summary email',`);
    expect(sqlText).toMatch(/, false\s+WHERE NOT EXISTS \(SELECT 1 FROM feature_flags WHERE key = 'summary_email'\)/);
  });
  it('is additive and transactional, and requires the verified column', () => {
    expect(sqlText).not.toMatch(/\bDROP\b|ALTER\s+COLUMN|ALTER\s+TABLE\s+"user"/i);
    expect(sqlText).toMatch(/^BEGIN;/m);
    expect(sqlText).toMatch(/^COMMIT;/m);
    expect(sqlText).toContain(`column_name = 'emailVerified'`);
    for (const t of ['email_preferences', 'summary_email_sends', 'email_outbox']) {
      expect(sqlText).toContain(`CREATE TABLE IF NOT EXISTS ${t}`);
    }
  });
});
