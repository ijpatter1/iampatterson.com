/**
 * Anonymous identity via first-party cookie (`_iap_aid`).
 *
 * Phase 10d D7. Threads `anonymous_id` into every data-layer push as a
 * cross-session identifier alongside the session-scoped `_iap_sid`. First-
 * party cookie is the honest baseline — localStorage is blocked from sGTM's
 * read path and breaks on subdomain hops.
 *
 * Consent: the cookie is classified Statistics in Cookiebot (Ian, 2026-11-14),
 * so it is written only while analytics consent is granted. Cookiebot
 * statistics is the analytics consent `src/lib/events/track.ts` holds, and the
 * caller passes that honored state in. Without it, nothing is minted, written
 * or refreshed and the ID is the empty string: a visitor who declines, or has
 * not chosen yet, carries no year-long identifier. On a decline Cookiebot
 * deletes the cookie, and nothing here mints it again. On a grant
 * `track.ts` mints the cookie, or reuses the one already there.
 *
 * Cookie properties:
 * - Path: / (available on all routes)
 * - SameSite: Lax (sent on top-level navigations; not on cross-site)
 * - Max-Age: 31536000 (365 days; refreshed on every consented read for a
 *   sliding window)
 * - Secure: only when on https origin (omitted on http://localhost dev)
 *
 * Categorized by `src/lib/identity/storage-categories.ts` as `app-identity`,
 * so it surfaces automatically in the Phase 10d D9 storage inspector
 * (Overview tab summary chip + Consent tab full per-key row) whenever it
 * exists.
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
 * Get the current anonymous ID, honoring analytics consent.
 *
 * `analyticsGranted` must be the honored analytics consent from
 * `getCurrentConsent()` in `src/lib/events/track.ts`, so there is one source
 * of truth for it. When it is false, returns '' and touches no cookie. When it
 * is true, mints an ID if needed and refreshes the cookie max-age (sliding
 * 365-day window).
 *
 * SSR-safe: returns '' when document is undefined. Callers treat '' as "no
 * ID", never as a real one.
 */
export function getAnonymousId(analyticsGranted: boolean): string {
  if (typeof document === 'undefined') return '';
  if (!analyticsGranted) return '';
  const existing = readAnonymousIdCookie();
  const id = existing ?? crypto.randomUUID();
  writeAnonymousIdCookie(id);
  return id;
}
