'use client';

import { useRef, useCallback } from 'react';
import type { ReactNode } from 'react';

import { useOverlay } from '@/components/overlay/overlay-context';

interface MobileBottomSheetShellProps {
  status: string;
  children: ReactNode;
}

export function MobileBottomSheetShell({ status, children }: MobileBottomSheetShellProps) {
  const { close } = useOverlay();
  const dragStartY = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (dragStartY.current === null) return;
      const deltaY = e.changedTouches[0].clientY - dragStartY.current;
      if (deltaY > 80) close();
      dragStartY.current = null;
    },
    [close],
  );

  return (
    <>
      <div
        role="button"
        tabIndex={-1}
        aria-label="Close overlay"
        className="fixed inset-0 z-40 bg-black/30 md:hidden"
        onClick={close}
        onKeyDown={(e) => {
          if (e.key === 'Escape') close();
        }}
      />
      <div
        data-testid="mobile-bottom-sheet"
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-2xl bg-white shadow-2xl md:hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex justify-center py-3" data-testid="drag-handle">
          <div className="h-1 w-10 rounded-full bg-neutral-300" />
        </div>
        <div className="flex items-center justify-between border-b border-neutral-100 px-4 pb-3">
          <h2 className="text-sm font-semibold text-neutral-900">Event Stream</h2>
          <div className="flex items-center gap-2">
            <span
              className={`flex h-2 w-2 rounded-full ${status === 'connected' ? 'bg-green-500' : 'bg-amber-500'}`}
            />
            <span className="text-xs text-neutral-500">
              {status === 'connected' ? 'Live' : status}
            </span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </>
  );
}
