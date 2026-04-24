/**
 * @jest-environment jsdom
 */
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_MAX_AGE,
  getSessionId,
  setSessionCookie,
  readSessionCookie,
  subscribeSessionCookie,
  notifySessionCookieChange,
  _getSessionCookieListenerCountForTests,
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

// Phase 10a D3: subscribe/notify channel that `useSessionId` +
// `useSessionContext` use to observe cookie changes. Owned here so
// every writer (setSessionCookie is the only one today; future
// logout/rotation paths would also land here) participates.
describe('subscribeSessionCookie / notifySessionCookieChange', () => {
  it('fires every subscribed callback exactly once per notifySessionCookieChange call', () => {
    const a = jest.fn();
    const b = jest.fn();
    const unsubA = subscribeSessionCookie(a);
    const unsubB = subscribeSessionCookie(b);

    notifySessionCookieChange();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);

    notifySessionCookieChange();
    expect(a).toHaveBeenCalledTimes(2);
    expect(b).toHaveBeenCalledTimes(2);

    unsubA();
    unsubB();
  });

  it('unsubscribe removes the callback from future notify calls', () => {
    const cb = jest.fn();
    const unsub = subscribeSessionCookie(cb);

    notifySessionCookieChange();
    expect(cb).toHaveBeenCalledTimes(1);

    unsub();
    notifySessionCookieChange();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('listener set count via _getSessionCookieListenerCountForTests tracks add + remove', () => {
    const baseline = _getSessionCookieListenerCountForTests();
    const unsub1 = subscribeSessionCookie(() => {});
    expect(_getSessionCookieListenerCountForTests()).toBe(baseline + 1);
    const unsub2 = subscribeSessionCookie(() => {});
    expect(_getSessionCookieListenerCountForTests()).toBe(baseline + 2);
    unsub1();
    expect(_getSessionCookieListenerCountForTests()).toBe(baseline + 1);
    unsub2();
    expect(_getSessionCookieListenerCountForTests()).toBe(baseline);
  });
});

// Phase 10a D3 Pass-3: setSessionCookie fires notify only on value
// change, not on max-age refresh. Keeps "writer fired" from
// blurring into "value changed" at the source — getSessionId
// passes through setSessionCookie on every event emission and
// would otherwise fire a notify cascade per event for identical
// cookie values.
describe('setSessionCookie change-detection', () => {
  it('notifies on first-time write (no prior cookie)', () => {
    const cb = jest.fn();
    const unsub = subscribeSessionCookie(cb);
    setSessionCookie('first-id');
    expect(cb).toHaveBeenCalledTimes(1);
    unsub();
  });

  it('notifies on value change (rotation)', () => {
    setSessionCookie('first-id');
    const cb = jest.fn();
    const unsub = subscribeSessionCookie(cb);
    setSessionCookie('second-id');
    expect(cb).toHaveBeenCalledTimes(1);
    unsub();
  });

  it('does NOT notify on same-value writes (max-age refresh)', () => {
    setSessionCookie('same-id');
    const cb = jest.fn();
    const unsub = subscribeSessionCookie(cb);
    setSessionCookie('same-id');
    setSessionCookie('same-id');
    setSessionCookie('same-id');
    expect(cb).not.toHaveBeenCalled();
    unsub();
  });
});
