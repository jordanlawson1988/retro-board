import { describe, it, expect } from 'vitest';
import { formatVoterList } from '@/utils/formatVoterList';
import type { Participant } from '@/types';

function p(id: string, name: string): Participant {
  return {
    id,
    board_id: 'b1',
    display_name: name,
    is_admin: false,
    user_id: null,
    joined_at: '2026-05-28T00:00:00Z',
    last_seen: '2026-05-28T00:00:00Z',
  };
}

const PEOPLE = [p('1', 'Jordan'), p('2', 'Charlton'), p('3', 'Harry')];

describe('formatVoterList', () => {
  it('maps voter IDs to display names in input order', () => {
    const out = formatVoterList(['1', '2', '3'], PEOPLE, null);
    expect(out.entries).toEqual([
      { id: '1', name: 'Jordan', isMine: false },
      { id: '2', name: 'Charlton', isMine: false },
      { id: '3', name: 'Harry', isMine: false },
    ]);
    expect(out.overflow).toBe(0);
  });

  it('tags the current participant as mine', () => {
    const out = formatVoterList(['2', '1'], PEOPLE, '1');
    expect(out.entries.find((e) => e.id === '1')?.isMine).toBe(true);
    expect(out.entries.find((e) => e.id === '2')?.isMine).toBe(false);
  });

  it('renders unknown IDs as Someone', () => {
    const out = formatVoterList(['1', 'ghost'], PEOPLE, null);
    expect(out.entries[1]).toEqual({ id: 'ghost', name: 'Someone', isMine: false });
  });

  it('caps at MAX_PEOPLE_NAMES entries and reports overflow', () => {
    const ids = Array.from({ length: 11 }, (_, i) => String(i + 1));
    const people = ids.map((id) => p(id, `User${id}`));
    const out = formatVoterList(ids, people, null);
    expect(out.entries).toHaveLength(8);
    expect(out.entries[0].name).toBe('User1');
    expect(out.entries[7].name).toBe('User8');
    expect(out.overflow).toBe(3);
  });

  it('handles empty voter list', () => {
    const out = formatVoterList([], PEOPLE, '1');
    expect(out.entries).toEqual([]);
    expect(out.overflow).toBe(0);
  });
});
