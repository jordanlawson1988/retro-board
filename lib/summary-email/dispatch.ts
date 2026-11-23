import { sql, sqlTransaction } from '@/lib/db';
import { canUse } from '@/lib/can-use';
import { SUMMARY_EMAIL_FEATURE } from '@/lib/constants/features';
import { GUIDED_MODE } from '@/lib/constants/phases';
import {
  BASE_URL_MISSING_ERROR,
  SUMMARY_EMAIL_BUILD_FAILED,
  SEND_FAILED,
  SEND_PENDING,
  SEND_RECORDED,
  SEND_SENT,
  SUMMARY_EMAIL_KIND,
  SUMMARY_EMAIL_MAX_RECIPIENTS,
  RESEND_TRANSPORT,
  type SummarySendStatus,
} from '@/lib/constants/email';
import { shapeCard, shapeComments, shapeVotes, PUBLIC_VIEWER, type ViewBoard } from '@/lib/board-view';
import { signUnsubscribeToken } from '@/lib/email-unsubscribe';
import { sendMail } from '@/lib/mail/send';
import type { MailMessage } from '@/lib/mail/transport';
import { buildRetroSummary } from '@/lib/summary';
import { appBaseUrl, renderSummaryEmail, summaryEmailLinks } from '@/lib/summary-email/render';
import { DEFAULT_BOARD_SETTINGS } from '@/utils/constants';
import type { ActionItem, BoardSettings, Card, Comment, Participant, Vote } from '@/types';

export type DispatchOutcome = 'flag-off' | 'stale' | 'no-recipients' | 'sent' | 'recorded' | 'failed' | 'error';

/** completedAt is the archived_at string the completing request wrote; it is never read back from the database. */
export interface DispatchInput {
  boardId: string;
  completedAt: string;
}

interface ClaimedRow {
  user_id: string;
  email: string;
}

/** The error's code or name only: a database message can quote row data, including an address. */
function errorLabel(e: unknown): string {
  const code = e && typeof e === 'object' ? (e as { code?: unknown }).code : undefined;
  if (typeof code === 'string' && code) return code;
  const name = e && typeof e === 'object' ? (e as { name?: unknown }).name : undefined;
  return typeof name === 'string' && name ? name : 'unknown';
}

async function recordOutcome(
  { boardId, completedAt }: DispatchInput,
  userIds: string[],
  status: SummarySendStatus,
  error: string | null
): Promise<void> {
  await sql`
    UPDATE summary_email_sends SET status = ${status}, error = ${error}, finished_at = now()
    WHERE board_id = ${boardId} AND completed_at = ${completedAt}::timestamptz
      AND user_id = ANY(${userIds}::text[]) AND status = ${SEND_PENDING}
  `;
}

/** The driver returns Date objects; the summary model is written for the JSON the browser gets. */
function toWireShape<T>(rows: T): T {
  return JSON.parse(JSON.stringify(rows)) as T;
}

export async function dispatchSummaryEmail(
  input: DispatchInput,
  env: Record<string, string | undefined> = process.env
): Promise<DispatchOutcome> {
  const { boardId, completedAt } = input;
  let claimedIds: string[] = [];
  let sendCalled = false;
  try {
    // 1. The flag. Off: nothing else runs.
    if (!(await canUse(SUMMARY_EMAIL_FEATURE, null))) return 'flag-off';

    // 2. One read-only snapshot of the board as this completion left it.
    const [boardRows, cardRows, voteRows, itemRows, participantRows, commentRows] = toWireShape(await sqlTransaction(
      (txn) => [
        txn`SELECT id, title, archived_at, trust_version, settings FROM boards
          WHERE id = ${boardId} AND archived_at = ${completedAt}::timestamptz AND deleted_at IS NULL AND mode = ${GUIDED_MODE}`,
        txn`SELECT * FROM cards WHERE board_id = ${boardId} ORDER BY position, created_at, id`,
        txn`SELECT * FROM votes WHERE board_id = ${boardId}`,
        txn`SELECT * FROM action_items WHERE board_id = ${boardId} ORDER BY created_at`,
        txn`SELECT * FROM participants WHERE board_id = ${boardId}`,
        txn`SELECT * FROM comments WHERE board_id = ${boardId} ORDER BY created_at, id`,
      ],
      { readOnly: true, isolationLevel: 'RepeatableRead' }
    ));
    const board = (boardRows as unknown as Record<string, unknown>[])[0] as unknown as { id: string; title: string; trust_version: 1 | 2; settings: Partial<BoardSettings> } | undefined;
    if (!board) return 'stale';

    // 3. Shape for the public, then build the summary.
    const viewBoard: ViewBoard = {
      trust_version: board.trust_version,
      settings: { ...DEFAULT_BOARD_SETTINGS, ...board.settings },
      archived_at: completedAt,
    };
    const summary = buildRetroSummary({
      board: { id: board.id, title: board.title, archived_at: completedAt },
      cards: (cardRows as unknown as Card[]).map((c) => shapeCard(c, viewBoard, PUBLIC_VIEWER)),
      votes: shapeVotes(voteRows as unknown as Vote[], viewBoard, PUBLIC_VIEWER),
      comments: shapeComments(commentRows as unknown as Comment[], PUBLIC_VIEWER),
      actionItems: itemRows as unknown as ActionItem[],
      participants: participantRows as unknown as Participant[],
    });

    // 4. Claim: select the recipients and write the record of intent in one statement.
    const claimed = (await sql`
      WITH board AS (
        SELECT id, owner_id FROM boards
        WHERE id = ${boardId} AND archived_at = ${completedAt}::timestamptz AND deleted_at IS NULL
      ), people AS (
        SELECT owner_id AS user_id FROM board WHERE owner_id IS NOT NULL
        UNION
        SELECT m.user_id FROM board_members m JOIN board ON m.board_id = board.id
      ), eligible AS (
        SELECT u.id AS user_id, u.email
        FROM people JOIN "user" u ON u.id = people.user_id
        LEFT JOIN email_preferences ep ON ep.user_id = u.id
        WHERE COALESCE(ep.summary_email, true)
          AND u."emailVerified" = true
          AND u.email LIKE '%_@_%'
        ORDER BY u.id
        LIMIT ${SUMMARY_EMAIL_MAX_RECIPIENTS}
      ), claimed AS (
        INSERT INTO summary_email_sends (board_id, completed_at, user_id, status)
        SELECT ${boardId}, ${completedAt}::timestamptz, user_id, ${SEND_PENDING} FROM eligible
        ON CONFLICT (board_id, completed_at, user_id) DO NOTHING
        RETURNING user_id
      )
      SELECT e.user_id, e.email FROM eligible e JOIN claimed c ON c.user_id = e.user_id ORDER BY e.user_id
    `) as unknown as ClaimedRow[];
    if (claimed.length === 0) return 'no-recipients';
    const userIds = claimed.map((r) => r.user_id);
    claimedIds = userIds;
    if (claimed.length === SUMMARY_EMAIL_MAX_RECIPIENTS) {
      console.warn('[summary-email] board ' + boardId + ': recipient cap reached (' + SUMMARY_EMAIL_MAX_RECIPIENTS + ')');
    }

    // 5. No base URL: the claimed rows are marked failed and nothing is sent.
    const base = appBaseUrl(env);
    if (!base) {
      await recordOutcome(input, userIds, SEND_FAILED, BASE_URL_MISSING_ERROR);
      return 'failed';
    }

    // 6. One message per claimed row, one send.
    const messages: MailMessage[] = claimed.map((row) =>
      renderSummaryEmail(summary, row.email, summaryEmailLinks(base, boardId, signUnsubscribeToken(row.user_id)))
    );
    sendCalled = true;
    const result = await sendMail({
      kind: SUMMARY_EMAIL_KIND,
      boardId,
      key: `summary/${boardId}/${Date.parse(completedAt)}`,
      messages,
    });

    // 7. Record the outcome. Nothing is retried.
    const status: SummarySendStatus = result.ok ? (result.transport === RESEND_TRANSPORT ? SEND_SENT : SEND_RECORDED) : SEND_FAILED;
    await recordOutcome(input, userIds, status, result.ok ? null : result.error);
    return status as DispatchOutcome;
  } catch (e) {
    console.error('[summary-email] board ' + boardId + ' failed: ' + errorLabel(e));
    // Only before sendMail was called: nothing went out, so say so. After it, mail may have gone
    // out and `pending` is the honest state.
    if (claimedIds.length > 0 && !sendCalled) {
      try {
        await recordOutcome(input, claimedIds, SEND_FAILED, SUMMARY_EMAIL_BUILD_FAILED);
      } catch (e2) {
        console.error('[summary-email] board ' + boardId + ' failed: ' + errorLabel(e2));
      }
    }
    return 'error';
  }
}
