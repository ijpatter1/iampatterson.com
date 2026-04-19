'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { DATA_LAYER_EVENT_NAMES } from '@/lib/events/schema';

interface Bubble {
  id: number;
  eventName: string;
  createdAt: number;
}

interface AmbientBubblesProps {
  /** Maximum number of visible bubbles at once. Default: 3 */
  maxBubbles?: number;
  /** How long each bubble stays visible in ms. Default: 3000 */
  duration?: number;
}

/**
 * Known iap_source event names derived from `DATA_LAYER_EVENT_NAMES` — the
 * same single source of truth `useDataLayerEvents` uses. Adding an event to
 * the schema automatically surfaces it here as a bubble-eligible name.
 */
const IAP_EVENT_NAMES: ReadonlySet<string> = new Set(DATA_LAYER_EVENT_NAMES);

let nextId = 0;

export function AmbientBubbles({ maxBubbles = 3, duration = 3000 }: AmbientBubblesProps) {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const lastIndexRef = useRef(
    typeof window !== 'undefined' && window.dataLayer ? window.dataLayer.length : 0,
  );
  const pollIntervalMs = 400;

  const addBubble = useCallback(
    (eventName: string) => {
      const id = nextId++;
      setBubbles((prev) => {
        const next = [...prev, { id, eventName, createdAt: Date.now() }];
        // Cap at maxBubbles — drop oldest
        return next.slice(-maxBubbles);
      });
      // Schedule removal
      setTimeout(() => {
        setBubbles((prev) => prev.filter((b) => b.id !== id));
      }, duration);
    },
    [maxBubbles, duration],
  );

  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof window === 'undefined' || !window.dataLayer) return;
      const dl = window.dataLayer;
      while (lastIndexRef.current < dl.length) {
        const entry = dl[lastIndexRef.current];
        lastIndexRef.current++;
        const eventName = entry?.event;
        if (typeof eventName === 'string' && IAP_EVENT_NAMES.has(eventName)) {
          addBubble(eventName);
        }
      }
    }, pollIntervalMs);

    return () => clearInterval(interval);
  }, [addBubble]);

  if (bubbles.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-20 right-6 z-40 flex flex-col-reverse items-end gap-2 md:bottom-24 md:right-8"
    >
      {bubbles.map((bubble) => (
        <div
          key={bubble.id}
          role="status"
          className="animate-bubble-rise flex items-center gap-2 rounded-full border border-rule-soft bg-paper/90 px-3 py-1.5 font-mono text-[11px] text-ink-3 shadow-card backdrop-blur-sm"
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-current" />
          {bubble.eventName}
        </div>
      ))}
    </div>
  );
}
