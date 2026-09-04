/**
 * Claudish translator — verbatim UI strings.
 *
 * Single source of truth for every exact string the spec supplies. The
 * refusal and capacity lines are mirrored as constants in the Cloud Run
 * proxy (infrastructure/cloud-run/claudish-proxy); both sides are pinned
 * character-for-character in tests. Do not reword without updating the
 * spec, the proxy mirror, and the pins together.
 */

/** Shown when the model refuses mid-stream; any partial output is discarded. */
export const REFUSAL_MESSAGE =
  "This doesn't translate. It's not a dictionary gap; it's a line.";

/**
 * Shown in cache-only/capacity mode, and — by decision
 * (docs/sessions/session-2026-08-31-001.md, Decisions) — for generic
 * failures too. The real cause goes to
 * analytics as outcome: 'error'; the page never shows a broken state.
 */
export const CAPACITY_MESSAGE = "This isn't an outage. It's a boundary.";

export const FOOTER_ATTRIBUTION =
  'A toy by Ian Patterson · marketing measurement and agentic AI · iampatterson.com';

/** The only place the word "Google" may appear on the page (test-enforced). */
export const FOOTER_DISCLAIMER = 'Not affiliated with Google. Yet.';

export const RATE_UP_LABEL = 'Holds up.';
export const RATE_DOWN_LABEL = "You're absolutely right.";

/** BCP-47 private-use subtag for detected Claudish. */
export const CLAUDISH_LANG_TAG = 'en-x-claudish';

/** Live client-side detection label, spec-verbatim (hyphen, not em dash). */
export const DETECTED_LABEL = 'Claudish - detected';

/** The English twin: Google Translate always names its guess, so a page
 * that only ever labels the Claudish case reads as "nothing happened"
 * when plain English is pasted (user-reported during dev testing). */
export const DETECTED_LABEL_EN = 'English - detected';

/** Sub-confident tiers — the detector claims a side instead of hedging
 * (user decision: binary english/claudish, leaning variants allowed). */
export const LEANING_CLAUDISH_LABEL = 'Leaning Claudish';
export const LEANING_EN_LABEL = 'Leaning English';

export const TAB_LABELS = {
  source: ['Detect language', 'English', 'Claudish'],
  target: ['English', 'Claudish'],
} as const;
