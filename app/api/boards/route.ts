import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getSessionOrNull } from '@/lib/auth-helpers';

export async function POST(request: Request) {
  const { id, title, description, template, createdBy, settings, columns, participant } =
    await request.json();

  // Get authenticated user if available (board creation works for both auth'd and anon users)
  const session = await getSessionOrNull();
  const ownerId = session?.user?.id ?? null;

  // Insert board with owner_id
  await sql`
    INSERT INTO boards (id, title, description, template, created_by, owner_id, settings)
    VALUES (${id}, ${title}, ${description}, ${template}, ${createdBy}, ${ownerId}, ${JSON.stringify(settings)})
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

  return NextResponse.json({ boardId: id });
}
