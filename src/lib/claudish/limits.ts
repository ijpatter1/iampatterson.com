/**
 * Claudish translator — numeric limits shared across the client.
 *
 * INPUT_CAP must agree with the proxy's server-side cap (413 above it) and
 * with the char counter display — the counter shows the real cap by user
 * decision (plan §Resolved decisions #1), not Google Translate's 5,000.
 */

/** Max input characters (UTF-16 units, matching textarea maxLength and the server cap). */
export const INPUT_CAP = 1200;

/** Pause after the last keystroke before auto-translate fires. */
export const DEBOUNCE_MS = 600;

/** Share-URL character budget — headroom under the classic 2,048 limit. */
export const SHARE_URL_MAX = 1900;

/** Client-side translation cache entries (in-memory only; persistence is cut from v1). */
export const CLIENT_CACHE_MAX_ENTRIES = 50;

/** Spinner verb rotation cadence while awaiting the first token. */
export const SPINNER_VERB_INTERVAL_MS = 900;
