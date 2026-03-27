'use client';

import { useState } from 'react';

import { EventDetail } from '@/components/overlay/event-detail';
import { EventTimeline } from '@/components/overlay/event-timeline';
import { useOverlay } from '@/components/overlay/overlay-context';
import type { PipelineEvent } from '@/lib/events/pipeline-schema';

interface DesktopOverlayProps {
  events: PipelineEvent[];
}

export function DesktopOverlay({ events }: DesktopOverlayProps) {
  const { isOpen } = useOverlay();
  const [selectedEvent, setSelectedEvent] = useState<PipelineEvent | null>(null);

  if (!isOpen) return null;

  return (
    <div
      data-testid="desktop-overlay"
      className="fixed inset-y-0 right-0 z-40 hidden w-96 flex-col border-l border-neutral-200 bg-white/95 shadow-2xl backdrop-blur-sm md:flex"
    >
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-neutral-900">Event Stream</h2>
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-green-500" />
          <span className="text-xs text-neutral-500">Live</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {selectedEvent ? (
          <div className="flex-1 overflow-y-auto">
            <EventDetail event={selectedEvent} onClose={() => setSelectedEvent(null)} />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <EventTimeline
              events={events}
              onSelectEvent={setSelectedEvent}
              selectedEventId={undefined}
            />
          </div>
        )}
      </div>
    </div>
  );
}
