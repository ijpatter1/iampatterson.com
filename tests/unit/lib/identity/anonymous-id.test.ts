/**
 * @jest-environment jsdom
 */
import {
  ANONYMOUS_ID_COOKIE_NAME,
  ANONYMOUS_ID_MAX_AGE,
  getAnonymousId,
  readAnonymousIdCookie,
} from '@/lib/identity/anonymous-id';

const originalRandomUUID = crypto.randomUUID;
let uuidCounter = 0;

beforeEach(() => {
  // Clear the cookie before each test.
  document.cookie = `${ANONYMOUS_ID_COOKIE_NAME}=; Max-Age=0; Path=/`;
  // Deterministic UUID for assertions.
  uuidCounter = 0;
  Object.defineProperty(crypto, 'randomUUID', {
    configurable: true,
    value: () => {
      uuidCounter++;
      return `aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee${uuidCounter.toString().padStart(2, '0')}` as `${string}-${string}-${string}-${string}-${string}`;
    },
  });
});

afterEach(() => {
  Object.defineProperty(crypto, 'randomUUID', {
    configurable: true,
    value: originalRandomUUID,
  });
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

describe('getAnonymousId', () => {
  it('mints a new UUID on first call when the cookie is empty', () => {
    const id = getAnonymousId();
    expect(id).toMatch(/^aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee\d{2}$/);
  });

  it('persists the minted UUID to the cookie', () => {
    const id = getAnonymousId();
    expect(readAnonymousIdCookie()).toBe(id);
  });

  it('returns the same value on subsequent calls (idempotent)', () => {
    const first = getAnonymousId();
    const second = getAnonymousId();
    const third = getAnonymousId();
    expect(first).toBe(second);
    expect(second).toBe(third);
  });

  it('reads the existing value if the cookie was set before this call', () => {
    document.cookie = `${ANONYMOUS_ID_COOKIE_NAME}=preexisting-anon-id; Path=/`;
    expect(getAnonymousId()).toBe('preexisting-anon-id');
  });

  it('writes the cookie with Max-Age=31536000 (365 days)', () => {
    expect(ANONYMOUS_ID_MAX_AGE).toBe(31536000);
  });

  it('writes the cookie with SameSite=Lax', () => {
    // jsdom's document.cookie strips Max-Age/SameSite/Secure attributes when
    // read (it only round-trips name=value), so we can't introspect them
    // from the cookie string after writing. Instead, spy on the setter.
    let writtenCookie = '';
    const cookieDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => '',
      set: (v: string) => {
        writtenCookie = v;
      },
    });
    try {
      getAnonymousId();
      expect(writtenCookie).toContain('SameSite=Lax');
      expect(writtenCookie).toContain('Path=/');
      expect(writtenCookie).toContain(`Max-Age=${ANONYMOUS_ID_MAX_AGE}`);
    } finally {
      if (cookieDescriptor) Object.defineProperty(document, 'cookie', cookieDescriptor);
    }
  });

  // Note: the Secure flag conditional (`protocol === 'https:' ? '; Secure' : ''`
  // in writeAnonymousIdCookie) is verified by inspection — jsdom's
  // `globalThis.location.protocol` is non-configurable, so we can't toggle it
  // for an integration test. The conditional itself is one line and matches
  // the same pattern used in src/lib/events/session.ts which carries the
  // same untestable shape.

  it('refreshes the cookie max-age on every call (sliding 365-day window)', () => {
    // Pre-set a cookie so getAnonymousId reads-existing rather than mints-new.
    document.cookie = `${ANONYMOUS_ID_COOKIE_NAME}=existing; Path=/`;
    let writtenCookie = '';
    const cookieDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => `${ANONYMOUS_ID_COOKIE_NAME}=existing`,
      set: (v: string) => {
        writtenCookie = v;
      },
    });
    try {
      getAnonymousId();
      // The write should still have the full Max-Age attribute even when
      // the value didn't change — sliding window keeps the cookie from
      // expiring during long-lived visitor lifecycles.
      expect(writtenCookie).toContain(`Max-Age=${ANONYMOUS_ID_MAX_AGE}`);
      expect(writtenCookie).toContain('existing');
    } finally {
      if (cookieDescriptor) Object.defineProperty(document, 'cookie', cookieDescriptor);
    }
  });
});
