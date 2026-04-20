'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { ConsentView } from '@/components/overlay/consent-view';
import { EventDetail } from '@/components/overlay/event-detail';
import { EventTimeline } from '@/components/overlay/event-timeline';
import { NarrativeFlow } from '@/components/overlay/narrative-flow';
import { useOverlay } from '@/components/overlay/overlay-context';
import { SessionStateTab } from '@/components/overlay/session-state-tab';
import { useFilteredEvents } from '@/hooks/useFilteredEvents';
import { useLiveEvents } from '@/hooks/useLiveEvents';
import { trackSessionStateTabView } from '@/lib/events/track';
import type { PipelineEvent } from '@/lib/events/pipeline-schema';

type ViewMode = 'session_state' | 'timeline' | 'consent';
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
  return (
    <div className="overlay-chrome flex gap-1 border-b border-u-rule-soft bg-u-paper-alt px-4">
      {tabs.map((t) => {
        const isActive = active === t.mode;
        // Terminal-style bracket framing on the active tab label
        // (UX_PIVOT_SPEC §3.2 / REQUIREMENTS Phase 9E D2). Inactive tabs
        // render plain text; the bracket pair is the primary retrofuture
        // cue that the tab is selected, on top of the amber border.
        const label = isActive ? `[ ${t.label.toUpperCase()} ]` : t.label;
        return (
          <button
            key={t.mode}
            type="button"
            onClick={() => onChange(t.mode)}
            className={`relative flex items-center gap-2 border-b-2 px-4 py-3 font-mono text-[11px] uppercase tracking-widest transition-colors ${
              isActive
                ? 'border-accent-current text-accent-current'
                : 'border-transparent text-u-ink-3 hover:text-u-ink'
            }`}
            aria-label={t.label}
          >
            {label}
            {typeof t.count === 'number' && (
              <span className="rounded-sm bg-u-paper-deep px-1.5 py-0.5 font-mono text-[9px] text-u-ink-3">
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function UnderTheHoodView() {
  const { isOpen, close, pendingTab, consumePendingTab } = useOverlay();

  const { events } = useLiveEvents();
  const { filteredEvents } = useFilteredEvents(events, false);

  const [viewMode, setViewMode] = useState<ViewMode>('session_state');
  const [selectedEvent, setSelectedEvent] = useState<PipelineEvent | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [flashKey, setFlashKey] = useState(false);
  const hasBooted = useRef(false);
  // Tracks whether default_landing has already emitted for the current open.
  // Reset on close so each overlay-open that lands on Session State gets
  // exactly one emission — the landing event describes how the visitor
  // arrived, not tab transitions within the same open.
  const defaultLandingEmittedRef = useRef(false);

  // Tab-change handler that the tabs-bar calls. `manual_select` emits only
  // when the visitor actively clicks the Session State tab from the tabs
  // bar. Programmatic opens (overlay `open('session_state')`, pendingTab
  // consumption) go through `setViewMode` directly and do NOT emit —
  // they are not visitor-initiated choices from within the tabs bar.
  // The `default_landing` emitter below handles the non-click paths.
  const handleTabChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    if (mode === 'session_state') {
      trackSessionStateTabView('manual_select');
    }
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

  // default_landing emission: fires once per overlay-open when the landing
  // tab is Session State. Runs on isOpen/viewMode/pendingTab edges, gated
  // by a ref so intra-open tab transitions don't re-fire (a manual_select
  // click back to Session State is a distinct event with its own source).
  //
  // The pendingTab check defers emission until the pendingTab consumption
  // effect has run. On an `open('timeline')` call the initial render has
  // isOpen=true, viewMode='session_state' (default), pendingTab='timeline'
  // — emitting here would fire a spurious default_landing that doesn't
  // match where the visitor actually lands. Waiting for pendingTab=null
  // means we always see the post-transition viewMode.
  useEffect(() => {
    if (!isOpen) {
      defaultLandingEmittedRef.current = false;
      return;
    }
    if (pendingTab) return;
    if (viewMode === 'session_state' && !defaultLandingEmittedRef.current) {
      defaultLandingEmittedRef.current = true;
      trackSessionStateTabView('default_landing');
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

  if (!isOpen && !hasBooted.current) return null;

  const tabs: TabDef[] = [
    { mode: 'session_state', label: 'Session State' },
    { mode: 'timeline', label: 'Timeline', count: filteredEvents.length },
    { mode: 'consent', label: 'Consent' },
  ];

  return (
    <div
      data-testid="under-the-hood-view"
      data-phase={phase}
      aria-hidden={!isOpen}
      className={`fixed inset-0 z-50 flex flex-col bg-u-paper text-u-ink transition-opacity duration-200 ${
        isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      {/* Backdrop click closes */}
      <button
        type="button"
        aria-label="Close overlay"
        onClick={close}
        className="absolute inset-0 -z-10 cursor-default"
      />

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

      {/* Header */}
      <header className="overlay-chrome flex items-center justify-between border-b border-u-rule-soft bg-u-paper px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center border border-accent-current text-accent-current">
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
            <h1 className="font-display text-lg leading-none text-u-ink">Under the Hood</h1>
            <p className="mt-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-u-ink-3">
              <span className="inline-block h-1.5 w-1.5 animate-session-pulse rounded-full bg-accent-current" />
              Live · streaming your session events
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
              {viewMode === 'session_state' && <SessionStateTab />}
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
