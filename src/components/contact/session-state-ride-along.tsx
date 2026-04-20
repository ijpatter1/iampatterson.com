'use client';

import { useMemo, useState } from 'react';

import { useSessionState } from '@/components/session-state-provider';
import { toRideAlongPayload } from '@/lib/session-state/ride-along';

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
 * **Default-checked gating:** checked when `consent_snapshot.marketing`
 * is `granted`, unchecked when `denied`. The visible copy below the
 * checkbox also adjusts to explain the default — per spec, the measurement
 * stack doesn't hide from itself.
 *
 * **Provider-gated rendering:** `useSessionState()` returns `null` when
 * there's no provider (SSR or pre-mount path), so this component renders
 * nothing until the blob is available. Existing contact-page tests that
 * don't wrap with the provider see no disruption.
 *
 * Reference: `docs/UX_PIVOT_SPEC.md` §3.6.
 */
export function SessionStateRideAlong() {
  const state = useSessionState();
  // Default-checked gating reads the state's current consent snapshot on
  // first render. Subsequent consent changes don't retroactively flip the
  // box (the visitor's explicit check/uncheck intent wins once established).
  const initiallyChecked = state?.consent_snapshot.marketing === 'granted';
  const [checked, setChecked] = useState(initiallyChecked);

  // Payload is recomputed on every render so state progress (e.g. reaching
  // purchase mid-page) surfaces in the serialized field without needing a
  // re-click of the checkbox. `toRideAlongPayload` is a pure projection.
  const payload = useMemo(() => (state ? toRideAlongPayload(state) : null), [state]);

  if (!state || !payload) return null;

  const marketingDenied = state.consent_snapshot.marketing === 'denied';

  const summary = marketingDenied
    ? "You've denied marketing consent. Session state is off by default — check the box above if you'd like to share it anyway."
    : `You've triggered ${payload.event_types_triggered} of ${payload.event_types_total} event types, completed ${payload.ecommerce_demo_percentage}% of the ecommerce demo, and visited ${payload.pages_visited} pages. Your consent state and session ID will ride along.`;

  return (
    <div className="mt-5 rounded-card border border-border bg-surface-alt p-4">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          name="session_state_include"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-ink"
        />
        <span className="text-sm font-medium text-content">
          Share my session state with this message
        </span>
      </label>
      <p
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
