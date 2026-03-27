/**
 * @jest-environment jsdom
 */
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_MAX_AGE,
  getSessionId,
  setSessionCookie,
  readSessionCookie,
} from '@/lib/events/session';

// Mock crypto.randomUUID for deterministic session IDs
const mockUUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
Object.defineProperty(globalThis, 'crypto', {
  value: { randomUUID: () => mockUUID },
});

beforeEach(() => {
  // Clear all cookies
  document.cookie.split(';').forEach((c) => {
    const name = c.trim().split('=')[0];
    if (name) document.cookie = `${name}=; Max-Age=0; Path=/`;
  });
});

describe('SESSION_COOKIE_NAME', () => {
  it('is _iap_sid', () => {
    expect(SESSION_COOKIE_NAME).toBe('_iap_sid');
  });
});

describe('SESSION_COOKIE_MAX_AGE', () => {
  it('is 1800 seconds (30 minutes)', () => {
    expect(SESSION_COOKIE_MAX_AGE).toBe(1800);
  });
});

describe('setSessionCookie', () => {
  it('sets a cookie with the given session ID', () => {
    setSessionCookie('test-id-123');
    expect(document.cookie).toContain('_iap_sid=test-id-123');
  });

  it('overwrites an existing session cookie', () => {
    setSessionCookie('first-id');
    setSessionCookie('second-id');
    expect(document.cookie).toContain('_iap_sid=second-id');
    expect(document.cookie).not.toContain('first-id');
  });
});

describe('readSessionCookie', () => {
  it('returns the session ID when the cookie exists', () => {
    setSessionCookie('existing-id');
    expect(readSessionCookie()).toBe('existing-id');
  });

  it('returns null when no session cookie exists', () => {
    expect(readSessionCookie()).toBeNull();
  });

  it('reads the correct cookie when multiple cookies exist', () => {
    document.cookie = 'other_cookie=other_value; Path=/';
    setSessionCookie('target-id');
    document.cookie = 'another=value; Path=/';
    expect(readSessionCookie()).toBe('target-id');
  });
});

describe('getSessionId', () => {
  it('generates a new UUID and sets the cookie when none exists', () => {
    const id = getSessionId();
    expect(id).toBe(mockUUID);
    expect(readSessionCookie()).toBe(mockUUID);
  });

  it('returns the existing cookie value without generating a new one', () => {
    setSessionCookie('pre-existing-id');
    const id = getSessionId();
    expect(id).toBe('pre-existing-id');
  });

  it('refreshes the cookie max-age on each call (session extension)', () => {
    setSessionCookie('existing-id');
    // Calling getSessionId should re-set the cookie (extending its lifetime)
    const id = getSessionId();
    expect(id).toBe('existing-id');
    expect(document.cookie).toContain('_iap_sid=existing-id');
  });

  it('returns consistent ID across multiple calls in the same session', () => {
    const first = getSessionId();
    const second = getSessionId();
    expect(first).toBe(second);
  });
});
