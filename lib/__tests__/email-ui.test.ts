import { describe, it, expect } from 'vitest';
import { unsubscribeOutcome, preferenceFromResponse, tokenFromSearchParam } from '@/lib/email-ui';

describe('unsubscribeOutcome', () => {
  it('200 is done', () => expect(unsubscribeOutcome(200)).toBe('done'));
  it('400 is invalid', () => expect(unsubscribeOutcome(400)).toBe('invalid'));
  it.each([0, 201, 204, 401, 404, 429, 500, 503])('%i is failed', (s) => {
    expect(unsubscribeOutcome(s)).toBe('failed');
  });
});

describe('preferenceFromResponse', () => {
  it('200 with a boolean gives it', () => {
    expect(preferenceFromResponse(200, { summaryEmail: true })).toBe(true);
    expect(preferenceFromResponse(200, { summaryEmail: false })).toBe(false);
  });
  it('200 without a boolean summaryEmail is null', () => {
    expect(preferenceFromResponse(200, {})).toBeNull();
    expect(preferenceFromResponse(200, { summaryEmail: 'true' })).toBeNull();
    expect(preferenceFromResponse(200, { summaryEmail: 1 })).toBeNull();
    expect(preferenceFromResponse(200, null)).toBeNull();
    expect(preferenceFromResponse(200, undefined)).toBeNull();
    expect(preferenceFromResponse(200, 'x')).toBeNull();
    expect(preferenceFromResponse(200, [true])).toBeNull();
  });
  it('any other status is null even with a good body', () => {
    for (const s of [201, 204, 401, 404, 500]) {
      expect(preferenceFromResponse(s, { summaryEmail: true })).toBeNull();
    }
  });
});

describe('tokenFromSearchParam', () => {
  it('a non-empty string is the token', () => expect(tokenFromSearchParam('abc.def')).toBe('abc.def'));
  it('empty, missing and repeated are null', () => {
    expect(tokenFromSearchParam('')).toBeNull();
    expect(tokenFromSearchParam(undefined)).toBeNull();
    expect(tokenFromSearchParam(['a', 'b'])).toBeNull();
    expect(tokenFromSearchParam(['a'])).toBeNull();
    expect(tokenFromSearchParam([])).toBeNull();
  });
});
