'use client';

/**
 * Progressive text reveal for settled translations (Ian's UX decision,
 * 2026-09-01: the Claudish→English refinement loop stays invisible —
 * the panel shows "Translating…" until the final version, which then
 * streams in client-side). The wire still streams drafts underneath;
 * this hook only animates the reveal of the settled text.
 *
 * When `active` is false the full text passes through untouched (the
 * en2cl direction streams live and never uses the reveal).
 */
import { useEffect, useRef, useState } from 'react';

const CHARS_PER_SECOND = 1800;
const TICK_MS = 40;

export function useRevealText(text: string, active: boolean): string {
  const [visibleCount, setVisibleCount] = useState<number>(active ? 0 : text.length);
  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const key = `${active ? 'a' : 'p'}:${text}`;
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;
    if (!active || text.length === 0) {
      setVisibleCount(text.length);
      return;
    }
    const step = Math.max(1, Math.round((CHARS_PER_SECOND * TICK_MS) / 1000));
    // First chunk lands synchronously with the effect flush so the text
    // node exists the moment the translation settles (and short texts
    // reveal instantly).
    setVisibleCount(Math.min(step, text.length));
    if (text.length <= step) return;
    const timer = setInterval(() => {
      setVisibleCount((count) => {
        const next = count + step;
        if (next >= text.length) {
          clearInterval(timer);
          return text.length;
        }
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [text, active]);

  return active ? text.slice(0, visibleCount) : text;
}
