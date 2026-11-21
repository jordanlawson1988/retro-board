import { agendaVotesLabel } from '@/lib/agenda';
import { NO_OWNER_LABEL } from '@/lib/constants/agenda';
import {
  NO_DUE_DATE,
  SUMMARY_EMAIL_ACTIONS,
  SUMMARY_EMAIL_FULL,
  SUMMARY_EMAIL_HEADING_MAX,
  SUMMARY_EMAIL_INTRO,
  SUMMARY_EMAIL_NO_ACTIONS,
  SUMMARY_EMAIL_STOP,
  SUMMARY_EMAIL_TOPICS,
  SUMMARY_EMAIL_WHY,
  UNSUBSCRIBE_API_PATH,
  UNSUBSCRIBE_PAGE_PATH,
} from '@/lib/constants/email';
import { DUE_PREFIX, NO_TOPICS_DISCUSSED, OWNER_PREFIX, SUMMARY_PAGE_TITLE } from '@/lib/constants/summary';
import type { MailMessage } from '@/lib/mail/transport';
import { allActionItems, dueDateLabel, headlineSentence, ownerLabel, summaryPath, type RetroSummary } from '@/lib/summary';

/**
 * Pure: no clock, no randomness, no environment reads (appBaseUrl takes its env as an argument).
 * The email is forwarded and archived, so it reads only the title, the headline, each topic's
 * heading and score, and the action items. It never reads topic.threads, topic.cards or an author.
 */

export function appBaseUrl(env: Record<string, string | undefined>): string | null {
  const raw = (env.NEXT_PUBLIC_APP_URL || env.BETTER_AUTH_URL || '').trim().replace(/\/+$/, '');
  return /^https?:\/\/[^/\s]+/.test(raw) ? raw : null;
}

export interface SummaryEmailLinks {
  summaryUrl: string;
  unsubscribePageUrl: string;
  unsubscribePostUrl: string;
}

export function summaryEmailLinks(baseUrl: string, boardId: string, token: string): SummaryEmailLinks {
  const t = encodeURIComponent(token);
  return {
    summaryUrl: `${baseUrl}${summaryPath(boardId)}`,
    unsubscribePageUrl: `${baseUrl}${UNSUBSCRIBE_PAGE_PATH}?token=${t}`,
    unsubscribePostUrl: `${baseUrl}${UNSUBSCRIBE_API_PATH}?token=${t}`,
  };
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const oneLine = (s: string): string => s.replace(/[\r\n]+/g, ' ');

export function truncateHeading(s: string, max: number = SUMMARY_EMAIL_HEADING_MAX): string {
  const chars = Array.from(oneLine(s));
  return chars.length > max ? `${chars.slice(0, max).join('')}...` : chars.join('');
}

export function renderSummaryEmail(summary: RetroSummary, to: string, links: SummaryEmailLinks): MailMessage {
  const title = oneLine(summary.title);
  const headline = headlineSentence(summary.headline);
  const topics = summary.topics.map((t) => `${truncateHeading(t.heading)} (${agendaVotesLabel(t.score)})`);
  const actions = allActionItems(summary).map(
    (i) =>
      `${oneLine(i.description)} (${OWNER_PREFIX}${oneLine(ownerLabel(i) ?? NO_OWNER_LABEL)}; ${DUE_PREFIX}${dueDateLabel(i.due_date) ?? NO_DUE_DATE})`,
  );

  const text = [
    title,
    '',
    SUMMARY_EMAIL_INTRO,
    '',
    headline,
    '',
    SUMMARY_EMAIL_TOPICS,
    ...(topics.length ? topics.map((t, n) => `${n + 1}. ${t}`) : [NO_TOPICS_DISCUSSED]),
    '',
    SUMMARY_EMAIL_ACTIONS,
    ...(actions.length ? actions.map((a) => `- ${a}`) : [SUMMARY_EMAIL_NO_ACTIONS]),
    '',
    `${SUMMARY_EMAIL_FULL}: ${links.summaryUrl}`,
    '',
    SUMMARY_EMAIL_WHY,
    `${SUMMARY_EMAIL_STOP}: ${links.unsubscribePageUrl}`,
  ].join('\n');

  const e = escapeHtml;
  // A later step may add an AI summary paragraph here, between the headline and the topics.
  const html = [
    '<!doctype html><html lang="en"><body>',
    `<h1>${e(title)}</h1>`,
    `<p>${e(SUMMARY_EMAIL_INTRO)}</p>`,
    `<p>${e(headline)}</p>`,
    `<h2>${e(SUMMARY_EMAIL_TOPICS)}</h2>`,
    topics.length
      ? `<ol>${topics.map((t) => `<li>${e(t)}</li>`).join('')}</ol>`
      : `<p>${e(NO_TOPICS_DISCUSSED)}</p>`,
    `<h2>${e(SUMMARY_EMAIL_ACTIONS)}</h2>`,
    actions.length
      ? `<ul>${actions.map((a) => `<li>${e(a)}</li>`).join('')}</ul>`
      : `<p>${e(SUMMARY_EMAIL_NO_ACTIONS)}</p>`,
    `<p><a href="${e(links.summaryUrl)}">${e(SUMMARY_EMAIL_FULL)}</a></p>`,
    `<p>${e(SUMMARY_EMAIL_WHY)}<br><a href="${e(links.unsubscribePageUrl)}">${e(SUMMARY_EMAIL_STOP)}</a></p>`,
    '</body></html>',
  ].join('');

  return {
    to,
    subject: `${SUMMARY_PAGE_TITLE}: ${title}`,
    text,
    html,
    headers: {
      'List-Unsubscribe': `<${links.unsubscribePostUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}
