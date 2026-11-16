import { sql, sqlTransaction } from '@/lib/db';
import { nanoid } from 'nanoid';
import { NextResponse } from 'next/server';
import { getSessionOrNull } from '@/lib/auth-helpers';
import { generateJoinCode } from '@/lib/join-code';
import { rateLimitOr429 } from '@/lib/rate-limit';
import { setParticipantCookie } from '@/lib/participant-session';
import { readJsonObject } from '@/lib/request-body';
import { validateNewBoard, INVALID_BODY } from '@/lib/board-validation';

export async function POST(request: Request) {
  const limited = await rateLimitOr429(request, 'board-create', 10, 3600);
  if (limited) return limited;
  try {
    const body = await readJsonObject(request);
    if (!body) return NextResponse.json({ error: INVALID_BODY }, { status: 400 });
    const parsed = validateNewBoard(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { id, title, description, template, settings, columns, participant } = parsed.value;

    // Get authenticated user if available (board creation works for both auth'd and anon users)
    const session = await getSessionOrNull();
    const ownerId = session?.user?.id ?? null;

    // The server owns the creator's participant id; the client's suggestion is ignored.
    const creatorId = nanoid();

    // Generate a unique 5-digit join code
    let joinCode = generateJoinCode();
    for (let attempts = 0; attempts < 10; attempts++) {
      const [existing] = await sql`SELECT 1 FROM boards WHERE join_code = ${joinCode}`;
      if (!existing) break;
      joinCode = generateJoinCode();
    }

    // Board, columns, creator participant and owner membership commit together or not at all.
    // The creator is always the facilitator; any isAdmin hint in the body is ignored.
    await sqlTransaction((txn) => [
      txn`
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
      ...(ownerId
        ? [
            txn`
              INSERT INTO board_members (board_id, user_id, role)
              VALUES (${id}, ${ownerId}, 'owner')
            `,
          ]
        : []),
    ]);

    const res = NextResponse.json({
      boardId: id,
      joinCode,
      participantId: participant ? creatorId : null,
    });
    if (participant) setParticipantCookie(res, id, creatorId);
    return res;
  } catch (err) {
    console.error('Failed to create board:', err);
    return NextResponse.json({ error: 'Failed to create board' }, { status: 500 });
  }
}
