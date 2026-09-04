/**
 * Claudish translator — numeric limits shared across the client.
 *
 * INPUT_CAP must agree with the proxy's server-side cap (413 above it) and
 * with the char counter display — the counter shows the real cap by user
 * decision (docs/sessions/session-2026-08-31-001.md, Decisions), not
 * Google Translate's 5,000. 3,000 = LinkedIn's post limit (Ian,
 * 2026-09-01): any LinkedIn post fits; longer is a different product.
 */

/** Max input characters (UTF-16 units, matching textarea maxLength and the server cap). */
export const INPUT_CAP = 3000;

/** Pause after the last keystroke before auto-translate fires. */
export const DEBOUNCE_MS = 600;

/** Share-URL character budget — headroom under the classic 2,048 limit. */
export const SHARE_URL_MAX = 1900;

/** Client-side translation cache entries (in-memory only; persistence is cut from v1). */
export const CLIENT_CACHE_MAX_ENTRIES = 50;

/** Spinner verb rotation cadence while awaiting the first token. */
export const SPINNER_VERB_INTERVAL_MS = 900;
