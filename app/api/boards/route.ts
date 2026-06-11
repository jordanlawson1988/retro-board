import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getSessionOrNull } from '@/lib/auth-helpers';
import { generateJoinCode } from '@/lib/join-code';
import { rateLimitOr429 } from '@/lib/rate-limit';
import { getEntitlement } from '@/lib/entitlements';

export async function POST(request: Request) {
  const limited = await rateLimitOr429(request, 'board-create', 10, 3600);
  if (limited) return limited;
  try {
    const { id, title, description, template, createdBy, settings, columns, participant } =
      await request.json();

    // Creators must have an account (locked decision 2026-06-09). Participants
    // joining boards are untouched — never gate the join routes.
    const session = await getSessionOrNull();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Sign in to create a board', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }
    const ownerId = session.user.id;

    const entitlement = await getEntitlement(ownerId, session.user.email);
    if (!entitlement.canCreateBoard) {
      return NextResponse.json(
        {
          error: `The free plan includes ${entitlement.limit} active board. Complete or delete a board to free a slot, or upgrade for unlimited boards.`,
          code: 'BOARD_LIMIT_REACHED',
        },
        { status: 402 }
      );
    }

    // Generate a unique 5-digit join code
    let joinCode = generateJoinCode();
    for (let attempts = 0; attempts < 10; attempts++) {
      const [existing] = await sql`SELECT 1 FROM boards WHERE join_code = ${joinCode}`;
      if (!existing) break;
      joinCode = generateJoinCode();
    }

    // Insert board with owner_id and join_code
    await sql`
      INSERT INTO boards (id, title, description, template, created_by, owner_id, join_code, settings)
      VALUES (${id}, ${title}, ${description}, ${template}, ${createdBy}, ${ownerId}, ${joinCode}, ${JSON.stringify(settings)})
    `;

    // Insert columns
    for (const col of columns) {
      await sql`
        INSERT INTO columns (id, board_id, title, description, color, position)
        VALUES (${col.id}, ${id}, ${col.title}, ${col.description ?? null}, ${col.color}, ${col.position})
      `;
    }

    // Insert participant if provided
    if (participant) {
      await sql`
        INSERT INTO participants (id, board_id, display_name, is_admin, user_id)
        VALUES (${participant.id}, ${id}, ${participant.displayName}, ${participant.isAdmin ?? true}, ${ownerId})
      `;
    }

    // If authenticated, create board_members entry for the owner
    if (ownerId) {
      await sql`
        INSERT INTO board_members (board_id, user_id, role)
        VALUES (${id}, ${ownerId}, 'owner')
      `;
    }

    return NextResponse.json({ boardId: id, joinCode });
  } catch (err) {
    console.error('Failed to create board:', err);
    return NextResponse.json({ error: 'Failed to create board' }, { status: 500 });
  }
}
