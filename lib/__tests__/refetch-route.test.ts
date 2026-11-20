import { describe, it, expect } from 'vitest';
import { refetchRouteFor } from '@/lib/phases';

describe('refetchRouteFor', () => {
  it('a guided payload that asks for a refetch uses the coalesced runner', () => {
    expect(refetchRouteFor({ refetch: true, phase: 'done' })).toBe('coalesced');
    expect(refetchRouteFor({ refetch: true, phase: 'discuss' })).toBe('coalesced');
  });

  it('an open payload (no phase, or null) that asks for a refetch uses the direct fetch', () => {
    expect(refetchRouteFor({ refetch: true })).toBe('direct');
    expect(refetchRouteFor({ refetch: true, phase: null })).toBe('direct');
  });

  it('an unknown phase value is treated as an open payload', () => {
    expect(refetchRouteFor({ refetch: true, phase: 'bogus' })).toBe('direct');
  });

  it('refetches only when refetch is exactly true', () => {
    expect(refetchRouteFor({ phase: 'done' })).toBe('none');
    expect(refetchRouteFor({ refetch: false, phase: 'done' })).toBe('none');
    expect(refetchRouteFor({ refetch: 'true', phase: 'done' })).toBe('none');
    expect(refetchRouteFor(undefined)).toBe('none');
    expect(refetchRouteFor(null)).toBe('none');
    expect(refetchRouteFor('x')).toBe('none');
  });
});
