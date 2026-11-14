/**
 * @jest-environment jsdom
 */
import {
  ANONYMOUS_ID_COOKIE_NAME,
  ANONYMOUS_ID_MAX_AGE,
  readAnonymousIdCookie,
} from '@/lib/identity/anonymous-id';

beforeEach(() => {
  document.cookie = `${ANONYMOUS_ID_COOKIE_NAME}=; Max-Age=0; Path=/`;
});

describe('readAnonymousIdCookie', () => {
  it('returns null when the cookie is not set', () => {
    expect(readAnonymousIdCookie()).toBeNull();
  });

  it('returns the cookie value when it is set', () => {
    document.cookie = `${ANONYMOUS_ID_COOKIE_NAME}=existing-uuid-value; Path=/`;
    expect(readAnonymousIdCookie()).toBe('existing-uuid-value');
  });

  it('decodes URI-encoded cookie values', () => {
    document.cookie = `${ANONYMOUS_ID_COOKIE_NAME}=${encodeURIComponent('uuid/with/slashes')}; Path=/`;
    expect(readAnonymousIdCookie()).toBe('uuid/with/slashes');
  });
});

describe('ANONYMOUS_ID_MAX_AGE', () => {
  it('is 365 days', () => {
    expect(ANONYMOUS_ID_MAX_AGE).toBe(31536000);
  });
});

// Minting, refreshing and expiring the cookie follow analytics consent and
// are tested through the consent path in tests/unit/events/track.test.ts.
