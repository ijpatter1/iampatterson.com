'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { ConsentView } from '@/components/overlay/consent-view';
import { DashboardView } from '@/components/overlay/dashboard-view';
import { EventDetail } from '@/components/overlay/event-detail';
import { EventTimeline } from '@/components/overlay/event-timeline';
import { HomepageUnderside } from '@/components/overlay/homepage-underside';
import { NarrativeFlow } from '@/components/overlay/narrative-flow';
import { useOverlay } from '@/components/overlay/overlay-context';
import { useEventStream } from '@/hooks/useEventStream';
import { useFilteredEvents } from '@/hooks/useFilteredEvents';
import type { PipelineEvent } from '@/lib/events/pipeline-schema';

type ViewMode = 'overview' | 'timeline' | 'narrative' | 'consent' | 'dashboards';

function ViewTabs({
  active,
  onChange,
  showOverview,
}: {
  active: ViewMode;
  onChange: (mode: ViewMode) => void;
  showOverview: boolean;
}) {
  const tabs: { mode: ViewMode; label: string }[] = [
    ...(showOverview ? [{ mode: 'overview' as ViewMode, label: 'Overview' }] : []),
    { mode: 'timeline', label: 'Timeline' },
    { mode: 'narrative', label: 'Narrative' },
    { mode: 'consent', label: 'Consent' },
    { mode: 'dashboards', label: 'Dashboards' },
  ];
  return (
    <div className="flex border-b border-border px-6">
      {tabs.map(({ mode, label }) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          className={`px-4 py-3 text-sm font-medium transition-colors ${
            active === mode
              ? 'border-b-2 border-content text-content'
              : 'text-content-muted hover:text-content-secondary'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function UnderTheHoodView() {
  const { isOpen, close } = useOverlay();
  const pathname = usePathname();
  const isHomepage = pathname === '/';
  const baseUrl = process.env.NEXT_PUBLIC_EVENT_STREAM_URL ?? '';
  const eventStreamUrl = baseUrl.endsWith('/events') ? baseUrl : `${baseUrl}/events`;
  // Keep SSE connection alive even when overlay is closed so events
  // accumulate in the buffer. When the user opens the view, they see
  // their full session history — not just events fired after opening.
  const { events, status } = useEventStream({
    url: eventStreamUrl,
    enabled: baseUrl.length > 0,
  });
  const { filteredEvents } = useFilteredEvents(events, false);
  const [viewMode, setViewMode] = useState<ViewMode>(isHomepage ? 'overview' : 'timeline');
  const [selectedEvent, setSelectedEvent] = useState<PipelineEvent | null>(null);

  if (!isOpen) return null;

  return (
    <div data-testid="under-the-hood-view" className="fixed inset-0 z-50 flex flex-col bg-surface">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-dark">
            <svg
              width="16"
              height="16"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-content-inverse"
            >
              <rect x="2" y="2" width="16" height="16" rx="2" />
              <path d="M10 2v16" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-content">Under the Hood</h1>
            <p className="text-xs text-content-muted">
              {status === 'connected'
                ? 'Live — streaming your session events'
                : 'Viewing instrumentation layer'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Back to site"
          className="flex items-center gap-2 rounded-card border border-border px-4 py-2 text-sm font-medium text-content-secondary transition-colors hover:bg-surface-alt hover:text-content"
        >
          &larr; Back to site
        </button>
      </header>

      {/* View tabs */}
      <ViewTabs active={viewMode} onChange={setViewMode} showOverview={isHomepage} />

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-content px-6 py-8">
          {selectedEvent ? (
            <>
              <EventDetail event={selectedEvent} onClose={() => setSelectedEvent(null)} />
              <div className="mt-6 border-t border-border pt-6">
                <NarrativeFlow event={selectedEvent} />
              </div>
            </>
          ) : (
            <>
              {viewMode === 'overview' && <HomepageUnderside />}
              {viewMode === 'timeline' && (
                <EventTimeline events={filteredEvents} onSelectEvent={setSelectedEvent} />
              )}
              {viewMode === 'narrative' && <NarrativeFlow event={filteredEvents[0] ?? null} />}
              {viewMode === 'consent' && <ConsentView events={filteredEvents} />}
              {viewMode === 'dashboards' && <DashboardView />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
