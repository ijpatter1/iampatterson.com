/**
 * Anonymous identity via first-party cookie (`_iap_aid`).
 *
 * Phase 10d D7. Threads `anonymous_id` into every data-layer push as a
 * cross-session identifier alongside the session-scoped `_iap_sid`. First-
 * party cookie is the honest baseline — localStorage is blocked from sGTM's
 * read path and breaks on subdomain hops.
 *
 * Consent: the cookie is classified Statistics in Cookiebot (Ian, 2026-11-14),
 * so it exists only while analytics consent is granted. This module is
 * read-only on purpose. The only writer is `applyAnonymousIdConsent` in
 * `src/lib/events/track.ts`, which holds the honored analytics consent: a
 * grant mints the cookie (or reuses and refreshes the one already there), and
 * an explicit decline or withdrawal expires it (never the init path, which can
 * see Cookiebot's default before a stored grant resolves). No export here can
 * write it, so no caller can mint the ID without consent. A visitor who
 * declines, or has not chosen yet, carries no year-long identifier, and
 * events carry ''.
 *
 * Cookie properties (set in `track.ts`):
 * - Path: / (available on all routes)
 * - SameSite: Lax (sent on top-level navigations; not on cross-site)
 * - Max-Age: 31536000 (365 days; refreshed on each grant, which runs on every
 *   page load for a visitor with a stored choice)
 * - Secure: only when on https origin (omitted on http://localhost dev)
 *
 * Categorized by `src/lib/identity/storage-categories.ts` as `analytics`, so
 * it surfaces in the Phase 10d D9 storage inspector whenever it exists.
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
