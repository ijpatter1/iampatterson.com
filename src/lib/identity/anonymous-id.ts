/**
 * Anonymous identity via first-party cookie (`_iap_aid`).
 *
 * Phase 10d D7. Threads `anonymous_id` into every data-layer push as a
 * cross-session identifier alongside the session-scoped `_iap_sid`. First-
 * party cookie is the honest baseline — localStorage is blocked from sGTM's
 * read path and breaks on subdomain hops.
 *
 * Cookie properties:
 * - Path: / (available on all routes)
 * - SameSite: Lax (sent on top-level navigations; not on cross-site)
 * - Max-Age: 31536000 (365 days; refreshed on every read for sliding window)
 * - Secure: only when on https origin (omitted on http://localhost dev)
 *
 * Categorized by `src/lib/identity/storage-categories.ts` as `app-identity`,
 * so it surfaces automatically in the Phase 10d D9 storage inspector
 * (Overview tab summary chip + Consent tab full per-key row).
 */

export const ANONYMOUS_ID_COOKIE_NAME = '_iap_aid';
export const ANONYMOUS_ID_MAX_AGE = 31536000;

/** Read the anonymous ID from the cookie, or null if not set. */
export function readAnonymousIdCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const prefix = `${ANONYMOUS_ID_COOKIE_NAME}=`;
  const match = document.cookie.split('; ').find((c) => c.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : null;
}

function writeAnonymousIdCookie(id: string): void {
  if (typeof document === 'undefined') return;
  const secure = globalThis.location?.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${ANONYMOUS_ID_COOKIE_NAME}=${encodeURIComponent(id)}; Path=/; SameSite=Lax; Max-Age=${ANONYMOUS_ID_MAX_AGE}${secure}`;
}

/**
 * Get the current anonymous ID, minting one if needed. Refreshes the cookie
 * max-age on every call (sliding 365-day window). SSR-safe — returns an
 * empty string when document is undefined; callers should treat that as
 * "not yet known" rather than a real ID.
 */
export function getAnonymousId(): string {
  if (typeof document === 'undefined') return '';
  const existing = readAnonymousIdCookie();
  const id = existing ?? crypto.randomUUID();
  writeAnonymousIdCookie(id);
  return id;
}
