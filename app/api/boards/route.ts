import { sqlTransaction } from '@/lib/db';
import { nanoid } from 'nanoid';
import { NextResponse } from 'next/server';
import { getSessionOrNull } from '@/lib/auth-helpers';
import { withJoinCodeRetry } from '@/lib/join-code-retry';
import { rateLimitOr429 } from '@/lib/rate-limit';
import { setParticipantCookie } from '@/lib/participant-session';
import { readJsonObject } from '@/lib/request-body';
import { validateNewBoard, INVALID_BODY } from '@/lib/board-validation';
import { canUse } from '@/lib/can-use';
import { FIRST_PHASE, DEFAULT_PHASE_CONFIG, GUIDED_MODE } from '@/lib/constants/phases';
import { phaseSettings } from '@/lib/phases';
import { guidedVoteDefaults } from '@/lib/votes';

export async function POST(request: Request) {
  const limited = await rateLimitOr429(request, 'board-create', 10, 3600);
  if (limited) return limited;
  try {
    const body = await readJsonObject(request);
    if (!body) return NextResponse.json({ error: INVALID_BODY }, { status: 400 });
    const parsed = validateNewBoard(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { id, title, description, template, settings, columns, participant, mode } = parsed.value;

    // Get authenticated user if available (board creation works for both auth'd and anon users)
    const session = await getSessionOrNull();
    const ownerId = session?.user?.id ?? null;

    // Guided mode is gated by a feature flag. A failed lookup throws into the catch below, so no
    // board is created. Open boards never read feature_flags.
    if (mode === GUIDED_MODE && !(await canUse('guided_mode', ownerId))) {
      return NextResponse.json({ error: 'Guided mode is not available' }, { status: 403 });
    }

    // The server owns the creator's participant id; the client's suggestion is ignored.
    const creatorId = nanoid();

    // Board, columns and creator participant commit together or not at all. Ownership is
    // boards.owner_id alone; the owner gets no board_members row.
    // The join code is generated per attempt; a collision on uq_boards_join_code rolls the whole
    // transaction back and retries with a new code (no pre-check round-trip).
    // The creator is always the facilitator; any isAdmin hint in the body is ignored.
    const joinCode = await withJoinCodeRetry((joinCode) =>
      sqlTransaction((txn) => [
        // Only the guided insert names the migration-015 columns, so an open create is unchanged
        // and keeps working on a database that does not have them yet.
        mode === GUIDED_MODE
          ? txn`
        INSERT INTO boards (id, title, description, template, created_by, owner_id, join_code, settings, trust_version, mode, phase, phase_config)
        VALUES (${id}, ${title}, ${description}, ${template}, ${creatorId}, ${ownerId}, ${joinCode}, ${JSON.stringify({ ...settings, ...phaseSettings(FIRST_PHASE), ...guidedVoteDefaults(settings) })}, 2, ${mode}, ${FIRST_PHASE}, ${JSON.stringify(DEFAULT_PHASE_CONFIG)}::jsonb)
      `
          : txn`
        INSERT INTO boards (id, title, description, template, created_by, owner_id, join_code, settings, trust_version)
        VALUES (${id}, ${title}, ${description}, ${template}, ${creatorId}, ${ownerId}, ${joinCode}, ${JSON.stringify(settings)}, 2)
      `,
        ...columns.map(
          (col) => txn`
          INSERT INTO columns (id, board_id, title, description, color, position)
          VALUES (${col.id}, ${id}, ${col.title}, ${col.description}, ${col.color}, ${col.position})
        `
        ),
        ...(participant
          ? [
              txn`
              INSERT INTO participants (id, board_id, display_name, is_admin, user_id)
              VALUES (${creatorId}, ${id}, ${participant.displayName}, true, ${ownerId})
            `,
            ]
          : []),
      ])
    );

    const res = NextResponse.json({
      boardId: id,
      joinCode,
      participantId: participant ? creatorId : null,
    });
    // Always issued: when no participant row was created yet, this cookie is the
    // creator's claim. The join route turns it into the facilitator participant,
    // so a creator without an account still ends up as the board's facilitator.
    setParticipantCookie(res, id, creatorId);
    return res;
  } catch (err) {
    console.error('Failed to create board:', err);
    return NextResponse.json({ error: 'Failed to create board' }, { status: 500 });
  }
}
