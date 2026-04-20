'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { ConsentView } from '@/components/overlay/consent-view';
import { EventDetail } from '@/components/overlay/event-detail';
import { EventTimeline } from '@/components/overlay/event-timeline';
import { NarrativeFlow } from '@/components/overlay/narrative-flow';
import { useOverlay } from '@/components/overlay/overlay-context';
import { OverviewTab } from '@/components/overlay/overview-tab';
import { useFilteredEvents } from '@/hooks/useFilteredEvents';
import { useLiveEvents } from '@/hooks/useLiveEvents';
import {
  trackConsentTabView,
  trackOverviewTabView,
  trackTimelineTabView,
} from '@/lib/events/track';
import type { PipelineEvent } from '@/lib/events/pipeline-schema';

type ViewMode = 'overview' | 'timeline' | 'consent';
type TabViewSource = 'default_landing' | 'manual_select';

// Per-tab view emitters. Keeping three functions (rather than a single
// `tab_view` event with a discriminator) so each tab gets its own
// coverage chip and the meter can signal depth-of-exploration across
// the three tabs.
const TAB_VIEW_TRACKERS: Record<ViewMode, (source: TabViewSource) => void> = {
  overview: trackOverviewTabView,
  timeline: trackTimelineTabView,
  consent: trackConsentTabView,
};
type Phase = 'idle' | 'boot' | 'on';

const BOOT_DURATION_MS = 260;

// sessionStorage key recording that the boot sequence has already played this
// browser session. First open of the session fires boot and sets the flag;
// every subsequent open within the same tab lifetime goes straight to phase-on.
// Scoped to sessionStorage (not localStorage) so a new browsing session — new
// tab, new window — gets the boot gesture again. Exported so tests assert
// against the same constant rather than a duplicated string literal.
export const BOOT_SESSION_KEY = 'iampatterson.overlay.booted';

function hasBootedThisSession(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(BOOT_SESSION_KEY) === '1';
  } catch {
    // sessionStorage can throw under strict privacy settings — fail open so
    // the overlay still works, accepting that boot will replay in that case.
    return false;
  }
}

function markBootedThisSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(BOOT_SESSION_KEY, '1');
  } catch {
    // See hasBootedThisSession — we silently fall back to "boot every open".
  }
}

interface TabDef {
  mode: ViewMode;
  label: string;
  count?: number;
}

function Tabs({
  active,
  onChange,
  tabs,
}: {
  active: ViewMode;
  onChange: (mode: ViewMode) => void;
  tabs: TabDef[];
}) {
  // F5 UAT S11 fix: on 360px viewports the bracket-framed `[ OVERVIEW ]`
  // label plus padding + Timeline count badge overflowed a three-tab
  // row, line-wrapping the bracket to its own line. `overflow-x-auto`
  // at the container + `whitespace-nowrap` per button keeps each label
  // on a single line; if the row still exceeds viewport width, the
  // visitor can scroll the tab bar horizontally.
  return (
    <div className="overlay-chrome flex gap-1 overflow-x-auto border-b border-u-rule-soft bg-u-paper-alt px-2 md:px-4">
      {tabs.map((t) => {
        const isActive = active === t.mode;
        // Terminal-style bracket framing on the active tab label is the
        // primary cue that the tab is selected (UX_PIVOT_SPEC §3.2 +
        // F1 UAT feedback). All three labels render in the amber accent
        // — the bracket pair + border distinguish active from inactive.
        // Inactive tabs render the label plain (no brackets, no border
        // indicator) with a subtle opacity dip so they still feel like
        // navigation targets, not disabled chrome.
        const label = isActive ? `[ ${t.label.toUpperCase()} ]` : t.label;
        return (
          <button
            key={t.mode}
            type="button"
            onClick={() => onChange(t.mode)}
            className={`relative flex flex-shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 font-mono text-xs uppercase tracking-widest text-accent-current transition-opacity md:px-4 ${
              isActive
                ? 'border-accent-current opacity-100'
                : 'border-transparent opacity-60 hover:opacity-90'
            }`}
            aria-label={t.label}
          >
            {label}
            {typeof t.count === 'number' && (
              <span className="rounded-sm bg-u-paper-deep px-1.5 py-0.5 font-mono text-[10px] text-u-ink-3">
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function OverlayView() {
  const { isOpen, close, pendingTab, consumePendingTab } = useOverlay();

  const { events } = useLiveEvents();
  const { filteredEvents } = useFilteredEvents(events, false);

  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [selectedEvent, setSelectedEvent] = useState<PipelineEvent | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [flashKey, setFlashKey] = useState(false);
  const hasBooted = useRef(false);
  // Tracks whether the landing phase for the current overlay-open has been
  // resolved (i.e. the first post-pendingTab render has committed). Closing
  // this gate unconditionally on resolution — not only when default_landing
  // emits — is the key invariant: a later manual_select click that re-enters
  // session_state from Timeline/Consent must not re-trip the default_landing
  // emitter. Reset on close so each overlay-open restarts the landing phase.
  const landingResolvedRef = useRef(false);

  // Tab-change handler that the tabs-bar calls. `manual_select` emits on
  // every active click in the tabs bar, for whichever tab was clicked.
  // Programmatic opens (overlay `open('overview')`, pendingTab consumption)
  // go through `setViewMode` directly and do NOT emit — they are not
  // visitor-initiated choices from within the tabs bar. The
  // `default_landing` emitter below handles the non-click paths.
  const handleTabChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    TAB_VIEW_TRACKERS[mode]('manual_select');
  }, []);

  // If the opener requested a specific tab (e.g. footer "Consent state" link),
  // switch to it and clear the request so a subsequent open without a hint
  // doesn't re-select.
  useEffect(() => {
    if (pendingTab && isOpen) {
      setViewMode(pendingTab);
      consumePendingTab();
    }
  }, [pendingTab, isOpen, consumePendingTab]);

  // default_landing emission: fires once per overlay-open on the landing-
  // phase resolution, for whichever tab the landing resolved to. Runs on
  // isOpen/viewMode/pendingTab edges.
  //
  // The pendingTab check defers resolution until the pendingTab consumption
  // effect has run. On an `open('timeline')` call the initial render has
  // isOpen=true, viewMode='overview' (default), pendingTab='timeline'
  // — resolving here would classify the landing as overview when the
  // visitor actually ends up on timeline. Waiting for pendingTab=null means
  // we always see the post-transition viewMode.
  //
  // Once resolution completes, the gate closes UNCONDITIONALLY — whether
  // or not we emitted. This is load-bearing: if the visitor later clicks
  // a different tab, that click already emits `manual_select` via
  // handleTabChange. Without this invariant, the viewMode re-render would
  // also re-fire default_landing (the Pass 1 dual-fire bug). The two
  // emission paths must stay mutually exclusive per open.
  useEffect(() => {
    if (!isOpen) {
      landingResolvedRef.current = false;
      return;
    }
    if (pendingTab) return;
    if (!landingResolvedRef.current) {
      landingResolvedRef.current = true;
      TAB_VIEW_TRACKERS[viewMode]('default_landing');
    }
  }, [isOpen, viewMode, pendingTab]);

  useEffect(() => {
    if (!isOpen) {
      // Close: reset to idle, clear any mid-investigation state so the next
      // open lands on the tab-level view, not the visitor's stale selection.
      setPhase((p) => (p === 'idle' ? p : 'idle'));
      setSelectedEvent(null);
      return;
    }
    hasBooted.current = true;
    setFlashKey((k) => !k);
    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Capture whether the session was already booted BEFORE we mark it.
    // We always mark on open (both branches) so that D9's "once per session"
    // guarantee survives a reduced-motion → normal-motion transition mid-
    // session: a visitor who first opens with reduced-motion on, then later
    // disables it and reopens, should not see the boot sequence.
    const alreadyBooted = hasBootedThisSession();
    markBootedThisSession();
    if (reduced || alreadyBooted) {
      setPhase('on');
      return;
    }
    setPhase('boot');
    const id = window.setTimeout(() => setPhase('on'), BOOT_DURATION_MS);
    return () => window.clearTimeout(id);
  }, [isOpen]);

  // Escape-key close (F3 UAT S8 fix). The pre-F3 overlay had a -z-10
  // "backdrop button" at absolute inset-0 but it was permanently occluded
  // by the flex-column header/tabs/content children — never received a
  // click in practice. Since the overlay is a full-bleed modal (no visible
  // scrim), there's no "click outside" region to capture; Escape is the
  // standard modal escape hatch the visitor expects instead.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, close]);

  if (!isOpen && !hasBooted.current) return null;

  const tabs: TabDef[] = [
    { mode: 'overview', label: 'Overview' },
    { mode: 'timeline', label: 'Timeline', count: filteredEvents.length },
    { mode: 'consent', label: 'Consent' },
  ];

  return (
    <div
      data-testid="overlay-view"
      data-phase={phase}
      aria-hidden={!isOpen}
      className={`fixed inset-0 z-50 flex flex-col bg-u-paper text-u-ink transition-opacity duration-200 ${
        isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      {/* Ambient amber glow — rendered as a sibling of the CRT field, with
          no explicit z-index. Paints in step 6 of the stacking context
          (positioned, z:auto), ahead of the in-flow header (step 3) but
          BEHIND the positioned tabs/body (step 6, later DOM order). Result:
          the amber blend is scoped to the header surface — the specific
          effect the user asked to preserve. */}
      {(phase === 'boot' || phase === 'on') && (
        <div aria-hidden="true" data-testid="crt-ambient" className="crt-ambient" />
      )}

      {/* Boot sequence + scanlines — z-index: 3 so the opaque paint-down
          curtain, warm flicker, and persistent scanlines cover ALL overlay
          content (including positioned tabs/body). Mirrors the prototype's
          explicit `z-index: 3` on `.crt-field`. DOM order follows the
          prototype: flicker → bloom → scanlines, so the warm pulse is
          occluded by the black curtain while it's painting down. */}
      {(phase === 'boot' || phase === 'on') && (
        <div
          aria-hidden="true"
          data-testid="crt-field"
          className="pointer-events-none absolute inset-0"
          style={{ zIndex: 3 }}
        >
          <div className="crt-flicker" />
          <div className="crt-bloom" />
          <div className="crt-scanlines" />
        </div>
      )}

      {/* Header — F5 UAT S11 declutter: on mobile, hide the 32px icon +
          "Live · yours, right now" subtitle so only the "Session" title
          + close button remain. The icon + subtitle add visual weight
          to a narrow row that already fights the tab bar below for
          vertical real estate. Desktop keeps the fuller treatment. */}
      <header className="overlay-chrome flex items-center justify-between border-b border-u-rule-soft bg-u-paper px-4 py-3 md:px-6 md:py-4">
        <div className="flex items-center gap-3">
          <div className="hidden h-8 w-8 items-center justify-center border border-accent-current text-accent-current md:flex">
            <svg
              width="14"
              height="14"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect x="2" y="2" width="16" height="16" rx="1" />
              <path d="M10 2v16" />
            </svg>
          </div>
          <div>
            <h1 className="font-display text-lg leading-none text-u-ink">Session</h1>
            <p className="mt-1 hidden items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-u-ink-3 md:flex">
              <span className="inline-block h-1.5 w-1.5 animate-session-pulse rounded-full bg-accent-current" />
              Live · yours, right now
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={close}
          className="rounded-sm border border-u-rule-soft px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-u-ink-3 transition-colors hover:border-accent-current hover:text-accent-current"
        >
          ← Back to site
        </button>
      </header>

      <Tabs active={viewMode} onChange={handleTabChange} tabs={tabs} />

      <div className="relative flex-1 overflow-y-auto bg-u-paper text-u-ink">
        <div
          key={`${String(flashKey)}-${viewMode}`}
          className="tab-flash mx-auto max-w-content px-6 py-8"
        >
          {selectedEvent ? (
            <>
              <EventDetail event={selectedEvent} onClose={() => setSelectedEvent(null)} />
              <div className="mt-6 border-t border-u-rule-soft pt-6">
                <NarrativeFlow event={selectedEvent} />
              </div>
            </>
          ) : (
            <>
              {viewMode === 'overview' && <OverviewTab />}
              {viewMode === 'timeline' && (
                <EventTimeline events={filteredEvents} onSelectEvent={setSelectedEvent} />
              )}
              {viewMode === 'consent' && <ConsentView events={filteredEvents} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
