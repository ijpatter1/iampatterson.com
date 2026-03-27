'use client';

import { useState } from 'react';

import { ConsentView } from '@/components/overlay/consent-view';
import { DesktopOverlayShell } from '@/components/overlay/desktop-overlay-shell';
import { EventDetail } from '@/components/overlay/event-detail';
import { EventTimeline } from '@/components/overlay/event-timeline';
import { MobileBottomSheetShell } from '@/components/overlay/mobile-bottom-sheet-shell';
import { NarrativeFlow } from '@/components/overlay/narrative-flow';
import { useOverlay } from '@/components/overlay/overlay-context';
import { useEventStream } from '@/hooks/useEventStream';
import { useFilteredEvents } from '@/hooks/useFilteredEvents';
import type { PipelineEvent } from '@/lib/events/pipeline-schema';

type ViewMode = 'timeline' | 'narrative' | 'consent';

function ViewTabs({ active, onChange }: { active: ViewMode; onChange: (mode: ViewMode) => void }) {
  const tabs: { mode: ViewMode; label: string }[] = [
    { mode: 'timeline', label: 'Timeline' },
    { mode: 'narrative', label: 'Narrative' },
    { mode: 'consent', label: 'Consent' },
  ];
  return (
    <div className="flex border-b border-neutral-100 px-4">
      {tabs.map(({ mode, label }) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          className={`px-3 py-2 text-xs font-medium transition-colors ${
            active === mode
              ? 'border-b-2 border-neutral-900 text-neutral-900'
              : 'text-neutral-400 hover:text-neutral-600'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function OverlayContent({
  events,
  viewMode,
  onViewModeChange,
}: {
  events: PipelineEvent[];
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}) {
  const [selectedEvent, setSelectedEvent] = useState<PipelineEvent | null>(null);

  if (selectedEvent) {
    return (
      <>
        <EventDetail event={selectedEvent} onClose={() => setSelectedEvent(null)} />
        <div className="border-t border-neutral-100">
          <NarrativeFlow event={selectedEvent} />
        </div>
      </>
    );
  }

  return (
    <>
      <ViewTabs active={viewMode} onChange={onViewModeChange} />
      <div className="flex-1 overflow-y-auto">
        {viewMode === 'timeline' && (
          <EventTimeline events={events} onSelectEvent={setSelectedEvent} />
        )}
        {viewMode === 'narrative' && <NarrativeFlow event={events[0] ?? null} />}
        {viewMode === 'consent' && <ConsentView events={events} />}
      </div>
    </>
  );
}

export function OverlayPanel() {
  const { isOpen } = useOverlay();
  const eventStreamUrl = process.env.NEXT_PUBLIC_EVENT_STREAM_URL ?? '';
  const { events, status } = useEventStream({
    url: eventStreamUrl,
    enabled: isOpen && eventStreamUrl.length > 0,
  });
  const { filteredEvents } = useFilteredEvents(events, false);
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');

  if (!isOpen) return null;

  return (
    <>
      <DesktopOverlayShell status={status}>
        <OverlayContent
          events={filteredEvents}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      </DesktopOverlayShell>
      <MobileBottomSheetShell status={status}>
        <OverlayContent
          events={filteredEvents}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      </MobileBottomSheetShell>
    </>
  );
}
