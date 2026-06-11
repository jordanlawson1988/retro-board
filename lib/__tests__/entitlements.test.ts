import { describe, it, expect } from 'vitest';
import {
  resolveEntitlement,
  isSubscriptionEntitled,
  FREE_ACTIVE_BOARD_LIMIT,
  LAPSE_GRACE_DAYS,
} from '@/lib/entitlements';

const NOW = new Date('2026-06-10T12:00:00Z');
const daysFromNow = (d: number) => new Date(NOW.getTime() + d * 86_400_000).toISOString();

describe('isSubscriptionEntitled', () => {
  it('null subscription is not entitled', () => {
    expect(isSubscriptionEntitled(null, NOW)).toBe(false);
  });
  it('active and trialing are entitled', () => {
    expect(isSubscriptionEntitled({ status: 'active', current_period_end: null, canceled_at: null }, NOW)).toBe(true);
    expect(isSubscriptionEntitled({ status: 'trialing', current_period_end: null, canceled_at: null }, NOW)).toBe(true);
  });
  it('past_due stays entitled through the 14-day grace window (D3)', () => {
    const sub = { status: 'past_due', current_period_end: daysFromNow(-13), canceled_at: null };
    expect(isSubscriptionEntitled(sub, NOW)).toBe(true);
  });
  it('past_due loses entitlement after grace', () => {
    const sub = { status: 'past_due', current_period_end: daysFromNow(-(LAPSE_GRACE_DAYS + 1)), canceled_at: null };
    expect(isSubscriptionEntitled(sub, NOW)).toBe(false);
  });
  it('canceled uses canceled_at when period end is missing', () => {
    const inGrace = { status: 'canceled', current_period_end: null, canceled_at: daysFromNow(-2) };
    const pastGrace = { status: 'canceled', current_period_end: null, canceled_at: daysFromNow(-20) };
    expect(isSubscriptionEntitled(inGrace, NOW)).toBe(true);
    expect(isSubscriptionEntitled(pastGrace, NOW)).toBe(false);
  });
  it('paused and unknown statuses are not entitled', () => {
    expect(isSubscriptionEntitled({ status: 'paused', current_period_end: daysFromNow(30), canceled_at: null }, NOW)).toBe(false);
    expect(isSubscriptionEntitled({ status: 'garbage', current_period_end: daysFromNow(30), canceled_at: null }, NOW)).toBe(false);
  });
});

describe('resolveEntitlement', () => {
  it('allowlisted user is comped with no limit regardless of boards', () => {
    const e = resolveEntitlement({ isAllowlisted: true, subscription: null, activeBoards: 99, now: NOW });
    expect(e).toEqual({ plan: 'comped', canCreateBoard: true, activeBoards: 99, limit: null });
  });
  it('entitled subscriber is paid with no limit', () => {
    const e = resolveEntitlement({
      isAllowlisted: false,
      subscription: { status: 'active', current_period_end: null, canceled_at: null },
      activeBoards: 99,
      now: NOW,
    });
    expect(e.plan).toBe('paid');
    expect(e.canCreateBoard).toBe(true);
  });
  it('free user under the limit can create', () => {
    const e = resolveEntitlement({ isAllowlisted: false, subscription: null, activeBoards: 0, now: NOW });
    expect(e).toEqual({ plan: 'free', canCreateBoard: true, activeBoards: 0, limit: FREE_ACTIVE_BOARD_LIMIT });
  });
  it('free user at the limit cannot create (D1: limit = 1)', () => {
    const e = resolveEntitlement({ isAllowlisted: false, subscription: null, activeBoards: 1, now: NOW });
    expect(e.canCreateBoard).toBe(false);
  });
  it('lapsed-past-grace subscriber falls back to the free tier (D3)', () => {
    const e = resolveEntitlement({
      isAllowlisted: false,
      subscription: { status: 'canceled', current_period_end: daysFromNow(-30), canceled_at: daysFromNow(-30) },
      activeBoards: 4,
      now: NOW,
    });
    expect(e.plan).toBe('free');
    expect(e.canCreateBoard).toBe(false); // 4 actives > limit; existing boards stay untouched (D2)
  });
});
