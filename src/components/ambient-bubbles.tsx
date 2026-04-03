'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

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

const EVENT_LABELS: Record<string, string> = {
  page_view: 'page_view',
  scroll_depth: 'scroll_depth',
  click_nav: 'click_nav',
  click_cta: 'click_cta',
  form_start: 'form_start',
  form_submit: 'form_submit',
  form_field_focus: 'form_field_focus',
  consent_update: 'consent_update',
};

let nextId = 0;

export function AmbientBubbles({ maxBubbles = 3, duration = 3000 }: AmbientBubblesProps) {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const lastIndexRef = useRef(0);
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
        if (typeof eventName === 'string' && EVENT_LABELS[eventName]) {
          addBubble(EVENT_LABELS[eventName]);
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
          className="animate-bubble-rise rounded-full border border-brand-200/30 bg-surface-dark/80 px-3 py-1.5 text-xs font-mono text-content-on-dark backdrop-blur-sm"
        >
          {bubble.eventName}
        </div>
      ))}
    </div>
  );
}
