'use client';

import { useEffect, useState } from 'react';

import { useDataLayerEvents } from '@/hooks/useDataLayerEvents';
import { getSessionId } from '@/lib/events/session';

interface SessionPulseProps {
  /** When provided, renders a button that calls this on click. Otherwise renders a display-only span. */
  onClick?: () => void;
}

/**
 * Live session indicator — pulsing dot + short session ID + event count.
 *
 * Clickable variant (header) opens the under-the-hood overlay.
 * Display-only variant (footer / mobile sheet) is a passive status indicator.
 */
export function SessionPulse({ onClick }: SessionPulseProps) {
  const [sessionId, setSessionId] = useState('');
  const { events } = useDataLayerEvents();

  useEffect(() => {
    setSessionId(getSessionId());
  }, []);

  const shortId = sessionId ? sessionId.slice(-6) : '······';
  const count = events.length;

  const body = (
    <>
      <span
        className="relative inline-block h-2 w-2 rounded-full bg-accent-current"
        style={{ boxShadow: '0 0 0 0 color-mix(in oklab, var(--accent) 60%, transparent)' }}
      >
        <span className="absolute inset-0 animate-session-pulse rounded-full bg-accent-current" />
      </span>
      <span className="font-mono text-[11px] tracking-wide text-ink-3">
        ses <span className="text-ink">{shortId}</span> · {count} evt
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label="Look under the hood — live session"
        className="inline-flex items-center gap-2 rounded-sm px-1 py-0.5 transition-colors hover:bg-paper-alt focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-current focus-visible:ring-offset-2"
      >
        {body}
        <span className="text-[10px] text-accent-current" aria-hidden="true">
          ↗
        </span>
      </button>
    );
  }

  return <span className="inline-flex items-center gap-2">{body}</span>;
}
