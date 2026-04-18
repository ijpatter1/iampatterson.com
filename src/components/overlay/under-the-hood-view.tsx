'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { ConsentView } from '@/components/overlay/consent-view';
import { DashboardView } from '@/components/overlay/dashboard-view';
import { EcommerceUnderside } from '@/components/overlay/ecommerce/ecommerce-underside';
import { EventDetail } from '@/components/overlay/event-detail';
import { EventTimeline } from '@/components/overlay/event-timeline';
import { HomepageUnderside } from '@/components/overlay/homepage-underside';
import { NarrativeFlow } from '@/components/overlay/narrative-flow';
import { useOverlay } from '@/components/overlay/overlay-context';
import { useFilteredEvents } from '@/hooks/useFilteredEvents';
import { useLiveEvents } from '@/hooks/useLiveEvents';
import type { PipelineEvent } from '@/lib/events/pipeline-schema';

type ViewMode = 'overview' | 'timeline' | 'consent' | 'dashboards';
type Phase = 'idle' | 'boot' | 'on';

const BOOT_DURATION_MS = 260;

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
    <div className="flex gap-1 border-b border-u-rule-soft bg-u-paper-alt px-4">
      {tabs.map((t) => (
        <button
          key={t.mode}
          type="button"
          onClick={() => onChange(t.mode)}
          className={`relative flex items-center gap-2 border-b-2 px-4 py-3 font-mono text-[11px] uppercase tracking-widest transition-colors ${
            active === t.mode
              ? 'border-accent-current text-accent-current'
              : 'border-transparent text-u-ink-3 hover:text-u-ink'
          }`}
        >
          {t.label}
          {typeof t.count === 'number' && (
            <span className="rounded-sm bg-u-paper-deep px-1.5 py-0.5 font-mono text-[9px] text-u-ink-3">
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function UnderTheHoodView() {
  const { isOpen, close, pendingTab, consumePendingTab } = useOverlay();
  const pathname = usePathname() ?? '/';
  const isHomepage = pathname === '/';
  const isEcommerce = pathname.startsWith('/demo/ecommerce');
  const showOverview = isHomepage || isEcommerce;

  const { events } = useLiveEvents();
  const { filteredEvents } = useFilteredEvents(events, false);

  const [viewMode, setViewMode] = useState<ViewMode>(showOverview ? 'overview' : 'timeline');
  const [selectedEvent, setSelectedEvent] = useState<PipelineEvent | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [flashKey, setFlashKey] = useState(false);
  const hasBooted = useRef(false);

  // Reset viewMode if the current tab disappears (e.g. user navigates from /
  // to /demo/subscription while the overlay is closed; Overview tab vanishes
  // but stale 'overview' mode would leave the content pane blank on reopen).
  useEffect(() => {
    if (!showOverview && viewMode === 'overview') {
      setViewMode('timeline');
    }
  }, [showOverview, viewMode]);

  // If the opener requested a specific tab (e.g. footer "Consent state" link),
  // switch to it and clear the request so a subsequent open without a hint
  // doesn't re-select.
  useEffect(() => {
    if (pendingTab && isOpen) {
      if (pendingTab === 'overview' && !showOverview) {
        setViewMode('timeline');
      } else {
        setViewMode(pendingTab);
      }
      consumePendingTab();
    }
  }, [pendingTab, isOpen, showOverview, consumePendingTab]);

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
    if (reduced) {
      setPhase('on');
      return;
    }
    setPhase('boot');
    const id = window.setTimeout(() => setPhase('on'), BOOT_DURATION_MS);
    return () => window.clearTimeout(id);
  }, [isOpen]);

  if (!isOpen && !hasBooted.current) return null;

  const tabs: TabDef[] = [
    ...(showOverview ? [{ mode: 'overview' as ViewMode, label: 'Overview' }] : []),
    { mode: 'timeline', label: 'Timeline', count: filteredEvents.length },
    { mode: 'consent', label: 'Consent' },
    { mode: 'dashboards', label: 'Dashboards', count: 6 },
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

      {/* CRT field — only rendered once the boot hold is complete */}
      {phase === 'on' && (
        <div
          aria-hidden="true"
          data-testid="crt-field"
          className="pointer-events-none absolute inset-0"
        >
          <div className="crt-bloom" />
          <div className="crt-flicker" />
          <div className="crt-scanlines" />
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between border-b border-u-rule-soft bg-u-paper px-6 py-4">
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

      <Tabs active={viewMode} onChange={setViewMode} tabs={tabs} />

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
              {viewMode === 'overview' && isHomepage && <HomepageUnderside />}
              {viewMode === 'overview' && isEcommerce && (
                <EcommerceUnderside pathname={pathname} events={filteredEvents} />
              )}
              {viewMode === 'timeline' && (
                <EventTimeline events={filteredEvents} onSelectEvent={setSelectedEvent} />
              )}
              {viewMode === 'consent' && <ConsentView events={filteredEvents} />}
              {viewMode === 'dashboards' && <DashboardView />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Expose BOOT_DURATION_MS for tests.
export const __BOOT_DURATION_MS = BOOT_DURATION_MS;
