'use client';

import { useState, useRef, useCallback } from 'react';

import { EventDetail } from '@/components/overlay/event-detail';
import { EventTimeline } from '@/components/overlay/event-timeline';
import { useOverlay } from '@/components/overlay/overlay-context';
import type { PipelineEvent } from '@/lib/events/pipeline-schema';

interface MobileBottomSheetProps {
  events: PipelineEvent[];
}

export function MobileBottomSheet({ events }: MobileBottomSheetProps) {
  const { isOpen, close } = useOverlay();
  const [selectedEvent, setSelectedEvent] = useState<PipelineEvent | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (dragStartY.current === null) return;
      const deltaY = e.changedTouches[0].clientY - dragStartY.current;
      // Swipe down more than 80px to dismiss
      if (deltaY > 80) {
        close();
        setSelectedEvent(null);
      }
      dragStartY.current = null;
    },
    [close],
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 md:hidden"
        onClick={() => {
          close();
          setSelectedEvent(null);
        }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        data-testid="mobile-bottom-sheet"
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-2xl bg-white shadow-2xl md:hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle */}
        <div className="flex justify-center py-3" data-testid="drag-handle">
          <div className="h-1 w-10 rounded-full bg-neutral-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 px-4 pb-3">
          <h2 className="text-sm font-semibold text-neutral-900">Event Stream</h2>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-green-500" />
            <span className="text-xs text-neutral-500">Live</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {selectedEvent ? (
            <EventDetail event={selectedEvent} onClose={() => setSelectedEvent(null)} />
          ) : (
            <EventTimeline
              events={events}
              onSelectEvent={setSelectedEvent}
              selectedEventId={selectedEvent?.pipeline_id}
            />
          )}
        </div>
      </div>
    </>
  );
}
