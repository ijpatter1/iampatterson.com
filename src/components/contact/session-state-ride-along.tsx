'use client';

import { useMemo, useState } from 'react';

import { useSessionState } from '@/components/session-state-provider';
import { toRideAlongPayload } from '@/lib/session-state/ride-along';

const SUMMARY_ID = 'session-state-ride-along-summary';

/**
 * Phase 9E D8 — Contact-form session-state ride-along.
 *
 * Renders the visible checkbox + human-readable summary below the contact
 * form fields. When checked, serializes `toRideAlongPayload(state)` into
 * a hidden `name="session_state"` input so the payload transmits with the
 * form on submit. When unchecked, the hidden input is removed entirely —
 * no silent transmission under any condition per spec §3.6.
 *
 * **Known pre-existing gap (Phase 10 follow-up):** the contact form's
 * current `handleSubmit` fires `trackFormSubmit('contact', true)` and
 * navigates to `/contact/thanks` without sending the form body to any
 * backend. This component's hidden field is therefore serialized and
 * present in the DOM (inspectable, testable, and ready to transmit) but
 * lands nowhere until a real submit endpoint is wired up. Flagged in the
 * D8 handoff; not in scope for 9E.
 *
 * **Checked-state derivation — `userOverride ?? consentDefault`.** The
 * naive `useState(state?.consent_snapshot.marketing === 'granted')`
 * pattern breaks on the real-browser path because `useSessionState()`
 * returns `null` on the first render (the provider's init runs in
 * `useEffect`, not synchronously — see `session-state-provider.tsx:41`).
 * `useState` captures `false` on mount and never re-seeds, so a visitor
 * with marketing granted would see the box unchecked in production.
 * Instead: track an explicit user-override (`null` = "not clicked yet,
 * follow consent"; `boolean` = "user clicked, their intent governs") and
 * derive `checked` from the override-or-consent every render. This also
 * closes the consent-revocation path — a visitor who loads with marketing
 * granted (box auto-checked), then revokes via Cookiebot before clicking
 * the checkbox, auto-unchecks to match the new consent state instead of
 * leaving a stale `session_state` field that would ride along on submit
 * against a denied consent signal.
 *
 * **Provider-gated rendering:** `useSessionState()` returns null when no
 * provider (SSR / pre-mount), so the component renders nothing until the
 * blob is available. Existing contact-page tests that don't wrap with
 * the provider see no disruption.
 *
 * Reference: `docs/UX_PIVOT_SPEC.md` §3.6.
 */
export function SessionStateRideAlong() {
  const state = useSessionState();
  // `null` = user has not interacted; consent governs. Once the user
  // clicks the checkbox, `userOverride` pins their intent and consent
  // changes no longer retro-flip the box.
  const [userOverride, setUserOverride] = useState<boolean | null>(null);

  const payload = useMemo(() => (state ? toRideAlongPayload(state) : null), [state]);

  if (!state || !payload) return null;

  const marketingGranted = state.consent_snapshot.marketing === 'granted';
  const consentDefault = marketingGranted;
  const checked = userOverride ?? consentDefault;

  // Four copy variants keyed on (checked, marketing-granted). The
  // transparency conceit requires showing the concrete payload whenever
  // the box is checked — including when the visitor overrode a denied
  // consent — so the visitor always sees exactly what they're sharing.
  let summary: string;
  if (checked && marketingGranted) {
    summary = `You've triggered ${payload.event_types_triggered} of ${payload.event_types_total} event types, completed ${payload.ecommerce_demo_percentage}% of the ecommerce demo, and visited ${payload.pages_visited} pages. Your consent state and session ID will ride along.`;
  } else if (checked && !marketingGranted) {
    summary = `Overriding your denied marketing consent. You've triggered ${payload.event_types_triggered} of ${payload.event_types_total} event types, completed ${payload.ecommerce_demo_percentage}% of the ecommerce demo, and visited ${payload.pages_visited} pages. Your consent state and session ID will ride along.`;
  } else if (!checked && marketingGranted) {
    summary =
      'Session state will not be included with this message. Check the box above to share it.';
  } else {
    summary =
      "You've denied marketing consent. Session state is off by default — check the box above if you'd like to share it anyway.";
  }

  return (
    <div className="mt-5 rounded-card border border-border bg-surface-alt p-4">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          name="session_state_include"
          checked={checked}
          onChange={(e) => setUserOverride(e.target.checked)}
          aria-describedby={SUMMARY_ID}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-ink"
        />
        <span className="text-sm font-medium text-content">
          Share my session state with this message
        </span>
      </label>
      <p
        id={SUMMARY_ID}
        data-testid="ride-along-summary"
        className="mt-2 pl-7 text-xs leading-relaxed text-content-secondary"
      >
        {summary}
      </p>
      {checked && (
        <input type="hidden" name="session_state" value={JSON.stringify(payload)} readOnly />
      )}
    </div>
  );
}
