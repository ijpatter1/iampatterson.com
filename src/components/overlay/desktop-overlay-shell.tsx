'use client';

import type { ReactNode } from 'react';

interface DesktopOverlayShellProps {
  status: string;
  children: ReactNode;
}

export function DesktopOverlayShell({ status, children }: DesktopOverlayShellProps) {
  return (
    <div
      data-testid="desktop-overlay"
      className="fixed inset-y-0 right-0 z-40 hidden w-96 flex-col border-l border-neutral-200 bg-white/95 shadow-2xl backdrop-blur-sm md:flex"
    >
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
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
      <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
