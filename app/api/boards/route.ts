import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { id, title, description, template, createdBy, settings, columns, participant } =
    await request.json();

  // Insert board
  await sql`
    INSERT INTO boards (id, title, description, template, created_by, settings)
    VALUES (${id}, ${title}, ${description}, ${template}, ${createdBy}, ${JSON.stringify(settings)})
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
      INSERT INTO participants (id, board_id, display_name, is_admin)
      VALUES (${participant.id}, ${id}, ${participant.displayName}, ${participant.isAdmin ?? true})
    `;
  }

  return NextResponse.json({ boardId: id });
}
