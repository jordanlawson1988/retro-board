import { describe, it, expect } from 'vitest';
import { buildRetroSummary, headlineSentence } from '@/lib/summary';
import { signUnsubscribeToken, verifyUnsubscribeToken } from '../email-unsubscribe';
import {
  appBaseUrl, summaryEmailLinks, escapeHtml, truncateHeading, renderSummaryEmail,
} from '@/lib/summary-email/render';

const SECRET = 'test-secret-test-secret-test-secret-0123';
const at = (ms: number) => new Date(Date.UTC(2026, 10, 21, 10, 0, 0, ms)).toISOString();
const card = (id: string, ms: number, over: Record<string, unknown> = {}) => ({
  id, column_id: 'col', board_id: 'b1', text: `text ${id}`, author_name: 'AUTHOR-SECRET', author_id: 'p1', color: null,
  position: 0, merged_with: null, group_title: null, reactions: {}, created_at: at(ms), updated_at: at(ms), ...over,
});
const vote = (card_id: string, voter_id: string, count = 1) =>
  ({ id: `${card_id}-${voter_id}`, card_id, board_id: 'b1', voter_id, count, created_at: at(0) });
const item = (id: string, ms: number, card_id: string | null, over: Record<string, unknown> = {}) => ({
  id, board_id: 'b1', description: `do ${id}`, assignee: null, due_date: null, status: 'open', created_at: at(ms), card_id, ...over,
});

function build(over: { title?: string; groupTitle?: string; soloText?: string; desc?: string; assignee?: string } = {}) {
  return buildRetroSummary({
    board: { id: 'b1', title: over.title ?? 'Sprint 12', archived_at: at(999) },
    cards: [
      card('L', 1, { group_title: over.groupTitle ?? 'Deploys' }),
      card('k', 2, { merged_with: 'L', text: 'CHILD-SECRET' }),
      card('S', 3, { text: over.soloText ?? 'Slow builds' }),
    ],
    votes: [vote('L', 'p1', 2), vote('k', 'p2'), vote('S', 'p1')],
    comments: [{ id: 'c1', board_id: 'b1', card_id: 'L', parent_id: null, author_participant_id: 'p1', author_name: 'AUTHOR-SECRET',
      is_anonymous: false, body: 'COMMENT-SECRET', created_at: at(1), edited_at: null, deleted_at: null, is_mine: false }],
    actionItems: [
      item('i1', 1, 'L', { description: over.desc ?? 'Write the runbook', assignee: over.assignee ?? 'Bo', due_date: '2026-11-30' }),
      item('i2', 2, null, { description: 'Fix CI' }),
    ],
    participants: [{ id: 'p1', display_name: 'AUTHOR-SECRET', joined_at: at(1) }],
  } as never);
}

const links = summaryEmailLinks('https://x.test', 'b1', 'tok.en');
const render = (s = build()) => renderSummaryEmail(s, 'a@example.com', links);
const hrefs = (html: string) => [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);

describe('appBaseUrl', () => {
  it('normalizes and falls back', () => {
    expect(appBaseUrl({ NEXT_PUBLIC_APP_URL: 'https://a.test/' })).toBe('https://a.test');
    expect(appBaseUrl({ NEXT_PUBLIC_APP_URL: 'https://a.test///' })).toBe('https://a.test');
    expect(appBaseUrl({ BETTER_AUTH_URL: 'http://localhost:3001' })).toBe('http://localhost:3001');
    expect(appBaseUrl({ NEXT_PUBLIC_APP_URL: '', BETTER_AUTH_URL: 'https://b.test' })).toBe('https://b.test');
  });
  it('is null for nothing, junk or a non-http scheme', () => {
    expect(appBaseUrl({})).toBeNull();
    expect(appBaseUrl({ NEXT_PUBLIC_APP_URL: 'not a url' })).toBeNull();
    expect(appBaseUrl({ NEXT_PUBLIC_APP_URL: 'javascript:alert(1)' })).toBeNull();
    expect(appBaseUrl({ NEXT_PUBLIC_APP_URL: 'ftp://a.test' })).toBeNull();
    expect(appBaseUrl({ NEXT_PUBLIC_APP_URL: 'https://' })).toBeNull();
  });
});

describe('summaryEmailLinks', () => {
  it('builds three links and encodes the token', () => {
    expect(summaryEmailLinks('https://x.test', 'b1', 'a b&c')).toEqual({
      summaryUrl: 'https://x.test/board/b1/summary',
      unsubscribePageUrl: 'https://x.test/email/unsubscribe?token=a%20b%26c',
      unsubscribePostUrl: 'https://x.test/api/email/unsubscribe?token=a%20b%26c',
    });
  });
});

describe('escapeHtml and truncateHeading', () => {
  it('escapes the five characters', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
  });
  it('truncates by code points after flattening line breaks', () => {
    expect(truncateHeading('a'.repeat(200))).toBe('a'.repeat(120) + '...');
    expect(truncateHeading('x'.repeat(120))).toBe('x'.repeat(120));
    expect(truncateHeading('\u{1F600}'.repeat(130))).toBe('\u{1F600}'.repeat(120) + '...');
    expect(truncateHeading('a\r\n\nb')).toBe('a b');
  });
});

describe('renderSummaryEmail', () => {
  it('subject, and CR/LF in the title become one space', () => {
    expect(render().subject).toBe('Retro summary: Sprint 12');
    expect(render(build({ title: 'Sprint\r\n12' })).subject).toBe('Retro summary: Sprint 12');
    expect(render().to).toBe('a@example.com');
  });
  it('the text part carries the copy in order', () => {
    const { text } = render();
    const parts = [
      'Sprint 12', 'Your retro is complete. Here is a short summary.', headlineSentence(build().headline), 'Topics',
      '1. Deploys (3 votes)', '2. Slow builds (1 vote)', 'Action items',
      '- Write the runbook (Owner: Bo; Due: November 30, 2026)', '- Fix CI (Owner: No owner; Due: No due date)',
      'See the full summary: https://x.test/board/b1/summary', 'Stop getting summary emails: https://x.test/email/unsubscribe?token=',
    ];
    let at0 = -1;
    for (const p of parts) {
      const i = text.indexOf(p, at0 + 1);
      expect(i, p).toBeGreaterThan(at0);
      at0 = i;
    }
    expect(text).toContain('You got this email because you took part in this retro on RetroBoard.');
  });
  it('never carries comment text, child card text or any author', () => {
    const m = render();
    for (const part of [m.text, m.html, m.subject, JSON.stringify(m.headers)]) {
      expect(part).not.toContain('CHILD-SECRET');
      expect(part).not.toContain('COMMENT-SECRET');
      expect(part).not.toContain('AUTHOR-SECRET');
    }
  });
  it('html: structure, exactly two hrefs, no img, src, style or script', () => {
    const { html } = render();
    expect(html.startsWith('<!doctype html><html lang="en"><body>')).toBe(true);
    expect(html.endsWith('</body></html>')).toBe(true);
    expect(html).toContain('<li>Deploys (3 votes)</li>');
    expect(html).toContain('<li>Write the runbook (Owner: Bo; Due: November 30, 2026)</li>');
    expect(hrefs(html)).toEqual([
      'https://x.test/board/b1/summary',
      'https://x.test/email/unsubscribe?token=tok.en',
    ]);
    expect(html.match(/href=/g)).toHaveLength(2);
    for (const bad of ['<img', 'src=', 'style', '<script', 'http-equiv', '<link', '<iframe']) expect(html).not.toContain(bad);
  });
  it('headers are exactly the two unsubscribe keys', () => {
    const token = signUnsubscribeToken('user-1', SECRET);
    const l = summaryEmailLinks('https://x.test', 'b1', token);
    const m = renderSummaryEmail(build({ title: 'T\r\nBcc: evil@x.test', assignee: 'N\r\nBcc: evil' }), 'a@example.com', l);
    expect(Object.keys(m.headers).sort()).toEqual(['List-Unsubscribe', 'List-Unsubscribe-Post']);
    expect(m.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    const v = m.headers['List-Unsubscribe'];
    expect(v).toBe(`<https://x.test/api/email/unsubscribe?token=${encodeURIComponent(token)}>`);
    expect(v).not.toMatch(/[\r\n]/);
    for (const value of [m.subject, ...Object.values(m.headers)]) expect(value).not.toMatch(/[\r\n]/);
    const parsed = new URL(v.slice(1, -1)).searchParams.get('token');
    expect(verifyUnsubscribeToken(parsed, SECRET)).toEqual({ userId: 'user-1' });
  });
  it('truncates long headings in both parts', () => {
    const m = render(build({ groupTitle: 'a'.repeat(200) }));
    expect(m.text).toContain(`1. ${'a'.repeat(120)}... (3 votes)`);
    expect(m.html).toContain(`<li>${'a'.repeat(120)}... (3 votes)</li>`);
  });
  it('no topics and no items', () => {
    const s = buildRetroSummary({
      board: { id: 'b1', title: 'Empty', archived_at: at(1) }, cards: [], votes: [], comments: [], actionItems: [], participants: [],
    } as never);
    const m = render(s);
    for (const p of [m.text, m.html]) {
      expect(p).toContain('No topics were discussed.');
      expect(p).toContain('No action items.');
    }
  });
  it('contains no em dash', () => {
    const m = render();
    expect(m.text).not.toContain('—');
    expect(m.html).not.toContain('—');
  });
  it('is deterministic', () => {
    expect(render()).toEqual(render());
  });
});

describe('hostile input in every user-controlled field', () => {
  const HOSTILE = '<script>alert(1)</script>';
  const fields: [string, Parameters<typeof build>[0]][] = [
    ['board title', { title: HOSTILE }],
    ['group title', { groupTitle: HOSTILE }],
    ['card text heading', { groupTitle: undefined, soloText: HOSTILE }],
    ['action item description', { desc: HOSTILE }],
    ['owner display name', { assignee: HOSTILE }],
  ];
  for (const [name, over] of fields) {
    it(`${name}: script is escaped`, () => {
      const m = render(build(over));
      expect(m.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(m.html).not.toContain('<script');
      expect(m.html).not.toContain('</script');
      expect(hrefs(m.html)).toHaveLength(2);
    });
  }
  const payloads = ['"><img src=x onerror=alert(1)>', 'javascript:alert(1)', 'a & b', 'line1\nline2\r\nBcc: evil@x.test'];
  for (const [name, key] of [['board title', 'title'], ['group title', 'groupTitle'], ['action item description', 'desc'], ['owner display name', 'assignee']] as const) {
    for (const p of payloads) {
      it(`${name}: ${JSON.stringify(p)} cannot break out`, () => {
        const m = render(build({ [key]: p }));
        expect(m.html).not.toContain('<img');
        expect(m.html).not.toMatch(/<[^>]*\ssrc=/);
        expect(m.html).not.toContain('"><img');
        expect(m.html).not.toContain('a & b');
        expect(m.html.match(/<a /g)).toHaveLength(2);
        expect(hrefs(m.html).every((h) => h.startsWith('https://x.test/'))).toBe(true);
        expect(m.html).not.toMatch(/[\r]/);
        expect(m.subject).not.toMatch(/[\r\n]/);
        // no extra header-like lines: every non-empty text line is one of the known shapes
        const lines = m.text.split('\n').filter((l) => /^bcc:/i.test(l));
        expect(lines).toEqual([]);
        expect(m.text.split('\n').length).toBe(render().text.split('\n').length);
      });
    }
  }
  it('an ampersand is escaped to &amp;', () => {
    expect(render(build({ title: 'a & b' })).html).toContain('<h1>a &amp; b</h1>');
  });
  it('a javascript: string stays inert text, never an href', () => {
    const m = render(build({ desc: 'javascript:alert(1)' }));
    expect(m.html).toContain('<li>javascript:alert(1) (Owner');
    expect(hrefs(m.html).some((h) => h.startsWith('javascript'))).toBe(false);
  });
  it('a quote in the token is escaped inside the href', () => {
    const l = summaryEmailLinks('https://x.test', 'b1', 'x"y');
    const m = renderSummaryEmail(build(), 'a@example.com', l);
    expect(m.html).toContain('token=x%22y"');
  });
});
