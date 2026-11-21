// Shared fixtures for the vote route tests. vi.mock calls stay in each test file (they are hoisted per file).
export function ctxRow(settings: Record<string, unknown> = {}, over: Record<string, unknown> = {}) {
  return {
    id: 'b1', title: 'T', trust_version: 2,
    settings: { voting_enabled: true, max_votes_per_participant: 5, ...settings },
    archived_at: null, deleted_at: null, owner_id: 'owner', created_by: null,
    cp_id: 'p1', cp_is_admin: false, cp_display_name: 'Ann', claimed_exists: false,
    member_role: null, is_member: false, is_system_admin: false, session_live: true, user_participant_id: null,
    ...over,
  };
}
