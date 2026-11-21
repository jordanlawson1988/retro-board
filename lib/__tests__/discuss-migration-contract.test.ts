import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { COMMENT_BODY_MAX } from '@/lib/constants/comments';

const sqlText = readFileSync('scripts/migrations/017_discuss.sql', 'utf-8');

describe('017_discuss.sql contract', () => {
  it('the body length check matches COMMENT_BODY_MAX and a deleted comment keeps an empty body', () => {
    const m = /char_length\(body\)\s+BETWEEN\s+1\s+AND\s+(\d+)/i.exec(sqlText);
    expect(Number(m?.[1])).toBe(COMMENT_BODY_MAX);
    expect(sqlText).toMatch(/deleted_at IS NOT NULL AND body = ''/);
  });
  it('a deleted card or person never deletes an action item', () => {
    expect(sqlText).toMatch(/REFERENCES cards \(id, board_id\)\s+ON DELETE SET NULL \(card_id\)/);
    expect(sqlText).toMatch(/REFERENCES participants \(id, board_id\)\s+ON DELETE SET NULL \(assignee_participant_id\)/);
  });
  it('a reply stays on its parent\'s card and an author leaving keeps the comment', () => {
    expect(sqlText).toMatch(/FOREIGN KEY \(parent_id, card_id\) REFERENCES comments \(id, card_id\)/);
    expect(sqlText).toMatch(/ON DELETE SET NULL \(author_participant_id\)/);
  });
  it('is additive and transactional: no DROP, no ALTER COLUMN, BEGIN and COMMIT, guarded table', () => {
    expect(sqlText).not.toMatch(/\bDROP\b|ALTER\s+COLUMN/i);
    expect(sqlText).toMatch(/^BEGIN;/m);
    expect(sqlText).toMatch(/^COMMIT;/m);
    expect(sqlText).toMatch(/CREATE TABLE IF NOT EXISTS comments/);
  });
});
