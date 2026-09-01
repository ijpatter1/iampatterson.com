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
 *
 * The reveal position is keyed to the text: a new text resets the
 * position during render (React's "adjust state on prop change"
 * pattern), so the first chunk exists the moment the translation
 * settles and short texts reveal instantly. The interval only advances.
 */
import { useEffect, useState } from 'react';

const CHARS_PER_SECOND = 1800;
const TICK_MS = 40;
const STEP = Math.max(1, Math.round((CHARS_PER_SECOND * TICK_MS) / 1000));

interface RevealPosition {
  key: string;
  count: number;
}

function keyFor(text: string, active: boolean): string {
  return `${active ? 'a' : 'p'}:${text}`;
}

function initialCount(text: string, active: boolean): number {
  return active ? Math.min(STEP, text.length) : text.length;
}

export function useRevealText(text: string, active: boolean): string {
  const key = keyFor(text, active);
  const [position, setPosition] = useState<RevealPosition>(() => ({
    key,
    count: initialCount(text, active),
  }));

  if (position.key !== key) {
    setPosition({ key, count: initialCount(text, active) });
  }

  useEffect(() => {
    if (!active || text.length <= STEP) return;
    const timer = setInterval(() => {
      setPosition((current) => {
        if (current.key !== key) return current;
        const next = current.count + STEP;
        if (next >= text.length) {
          clearInterval(timer);
          return { key, count: text.length };
        }
        return { key, count: next };
      });
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [key, text, active]);

  const count = position.key === key ? position.count : initialCount(text, active);
  return active ? text.slice(0, count) : text;
}
