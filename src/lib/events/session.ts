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
 * - Max-Age: 1800s (30 min, matching GA4 session window, refreshed on activity)
 */

export const SESSION_COOKIE_NAME = '_iap_sid';
export const SESSION_COOKIE_MAX_AGE = 1800;

// Listener set for cookie-change notifications. Phase 10a D3 established
// `useSessionId` as a `useSyncExternalStore` observer over the session
// cookie; writing the cookie anywhere must notify so subscribers re-read
// the fresh value instead of staying stale until an unrelated re-render
// happens to fire their getSnapshot. The subscribe/notify pair lives
// here (alongside the only writer, `setSessionCookie`) rather than in
// the hook module so EVERY path that writes the cookie participates.
const cookieChangeListeners = new Set<() => void>();

export function subscribeSessionCookie(callback: () => void): () => void {
  cookieChangeListeners.add(callback);
  return () => {
    cookieChangeListeners.delete(callback);
  };
}

export function notifySessionCookieChange(): void {
  for (const l of cookieChangeListeners) l();
}

/** Test-only introspection: current size of the cookie-change listener set. */
export function _getSessionCookieListenerCountForTests(): number {
  return cookieChangeListeners.size;
}

/**
 * Write the session cookie and notify subscribers when the value
 * changed. Notify is suppressed on same-value writes (max-age refresh
 * with an existing cookie) — `getSessionId` funnels every event
 * emission through here, which would otherwise fire ~20 notifies per
 * 20-event session for identical values. `useSyncExternalStore` would
 * bail via `Object.is`, but "writer fired" should not blur into "value
 * changed" at the source.
 */
export function setSessionCookie(id: string): void {
  if (typeof document === 'undefined') return;
  const previous = readSessionCookie();
  const secure = globalThis.location?.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(id)}; Path=/; SameSite=Lax; Max-Age=${SESSION_COOKIE_MAX_AGE}${secure}`;
  if (previous !== id) notifySessionCookieChange();
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
