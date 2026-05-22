import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { sql } from '@/lib/db';

/**
 * Get the current session or null. Does not throw.
 * Use in API routes where auth is optional (e.g., board creation can be anonymous).
 */
export async function getSessionOrNull() {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });
    return session;
  } catch {
    return null;
  }
}

/**
 * Get the current session or throw 401.
 * Use in API routes that require authentication (e.g., dashboard, billing).
 */
export async function requireSession() {
  const session = await getSessionOrNull();
  if (!session?.user) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return session;
}

// ---------------------------------------------------------------------------
// Board authorization
// ---------------------------------------------------------------------------

export interface BoardAuthorityInput {
  userId: string;
  ownerId: string | null; // boards.owner_id
  memberRole: string | null; // board_members.role for this user, or null
  isSystemAdmin: boolean; // present in admin_users
}

export interface BoardAuthority {
  isOwner: boolean;
  canFacilitate: boolean;
  isSystemAdmin: boolean;
}

/**
 * Pure decision: given a user's standing on a board, what can they do?
 * Owner OR system admin OR a member with role owner/facilitator may facilitate.
 */
export function resolveBoardAuthority(i: BoardAuthorityInput): BoardAuthority {
  const isOwner = i.ownerId !== null && i.ownerId === i.userId;
  const canFacilitate =
    isOwner || i.isSystemAdmin || i.memberRole === 'owner' || i.memberRole === 'facilitator';
  return { isOwner, canFacilitate, isSystemAdmin: i.isSystemAdmin };
}

/** Typed authorization failure; routes convert it to a NextResponse. */
export class AuthzError extends Error {
  constructor(
    public status: 401 | 403,
    message: string
  ) {
    super(message);
    this.name = 'AuthzError';
  }
}

async function loadBoardAuthority(
  boardId: string
): Promise<BoardAuthority & { userId: string }> {
  const session = await getSessionOrNull();
  const userId = session?.user?.id ?? null;
  if (!userId) throw new AuthzError(401, 'Sign in required');

  const [row] = await sql`
    SELECT
      (SELECT owner_id FROM boards WHERE id = ${boardId})                                 AS owner_id,
      (SELECT role FROM board_members WHERE board_id = ${boardId} AND user_id = ${userId}) AS member_role,
      EXISTS (SELECT 1 FROM admin_users WHERE id = ${userId})                              AS is_system_admin
  `;

  const authority = resolveBoardAuthority({
    userId,
    ownerId: (row?.owner_id as string | null) ?? null,
    memberRole: (row?.member_role as string | null) ?? null,
    isSystemAdmin: !!row?.is_system_admin,
  });
  return { ...authority, userId };
}

/** Throw unless the caller may facilitate the board (owner / facilitator / system admin). */
export async function assertCanFacilitate(boardId: string): Promise<{ userId: string }> {
  const a = await loadBoardAuthority(boardId);
  if (!a.canFacilitate) throw new AuthzError(403, 'Facilitator access required');
  return { userId: a.userId };
}

/** Throw unless the caller is the board owner (or a system admin). */
export async function assertBoardOwner(boardId: string): Promise<{ userId: string }> {
  const a = await loadBoardAuthority(boardId);
  if (!a.isOwner && !a.isSystemAdmin) {
    throw new AuthzError(403, 'Only the board owner can do this');
  }
  return { userId: a.userId };
}

/** Map a thrown AuthzError to a response body+status; returns null for other errors. */
export function authzErrorResponse(
  e: unknown
): { body: { error: string }; status: number } | null {
  if (e instanceof AuthzError) return { body: { error: e.message }, status: e.status };
  return null;
}

