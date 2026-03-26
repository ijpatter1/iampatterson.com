/**
 * Session ID management via first-party cookie.
 *
 * The `_iap_sid` cookie is the session identifier shared between the browser
 * and sGTM (which runs on the same-origin custom domain io.iampatterson.com).
 * The client generates the ID; sGTM reads it from incoming requests.
 *
 * Cookie properties:
 * - Path: / (available on all routes)
 * - SameSite: Lax (sent on top-level navigations)
 * - Max-Age: 1800s (30 min, matching GA4 session window — refreshed on activity)
 */

export const SESSION_COOKIE_NAME = '_iap_sid';
export const SESSION_COOKIE_MAX_AGE = 1800;

/** Write the session cookie. */
export function setSessionCookie(id: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(id)}; Path=/; SameSite=Lax; Max-Age=${SESSION_COOKIE_MAX_AGE}`;
}

/** Read the session ID from the cookie, or null if not set. */
export function readSessionCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const prefix = `${SESSION_COOKIE_NAME}=`;
  const match = document.cookie.split('; ').find((c) => c.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : null;
}

/**
 * Get the current session ID, generating one if needed.
 * Refreshes the cookie max-age on every call (sliding window).
 */
export function getSessionId(): string {
  if (typeof document === 'undefined') return '';
  const existing = readSessionCookie();
  const id = existing ?? crypto.randomUUID();
  setSessionCookie(id);
  return id;
}
