import { sql } from '@/lib/db';
import { ablyServer } from '@/lib/ably-server';
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const { cardId, voterId, voteId } = await request.json();

  // Check if vote already exists
  const [existingVote] = await sql`
    SELECT * FROM votes WHERE card_id = ${cardId} AND voter_id = ${voterId} AND board_id = ${boardId}
  `;

  const channel = ablyServer.channels.get(`retro-board:${boardId}`);

  if (existingVote) {
    // Remove existing vote
    await sql`DELETE FROM votes WHERE id = ${existingVote.id}`;
    await channel.publish('vote-removed', { voteId: existingVote.id, cardId, voterId });
    return NextResponse.json({ action: 'removed' });
  }

  // Check vote limit
  const [board] = await sql`SELECT settings FROM boards WHERE id = ${boardId}`;
  const settings = board.settings;
  const maxVotes = settings?.max_votes_per_participant;

  if (maxVotes && maxVotes > 0) {
    const [{ count }] = await sql`
      SELECT COUNT(*)::int AS count FROM votes WHERE board_id = ${boardId} AND voter_id = ${voterId}
    `;
    if (count >= maxVotes) {
      return NextResponse.json(
        { error: 'Vote limit reached', maxVotes },
        { status: 422 }
      );
    }
  }

  // Insert new vote (use client-provided ID so Ably dedup works)
  const [vote] = await sql`
    INSERT INTO votes (id, card_id, board_id, voter_id)
    VALUES (${voteId || crypto.randomUUID()}, ${cardId}, ${boardId}, ${voterId})
    RETURNING *
  `;

  await channel.publish('vote-cast', { vote });

  return NextResponse.json({ action: 'added', vote });
}
