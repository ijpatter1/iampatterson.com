'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const DEFAULT_DURATION_MS = 1900;

export interface DiagnosticLine {
  text: string;
  /** Status tag rendered as `[OK]` / `[SKIP]` / `[LIVE]` etc. */
  tag?: string;
  /** Emphasises the line visually — used for the final payoff line. */
  emph?: boolean;
}

/**
 * Pattern 4 — Full-page diagnostic moment (Phase 9F deliverable 4).
 *
 * The one full-bleed transitional moment in the ecommerce demo. Renders a
 * full-bleed near-black overlay with amber typed-sequence text; auto-advances
 * over `duration` ms; calls `onComplete` exactly once on natural completion
 * OR on any `keydown` (skip). Reserved for exactly one usage site (checkout
 * submit → confirmation navigation) per UX_PIVOT_SPEC §3.5.
 *
 * Under prefers-reduced-motion the moment is skipped entirely — onComplete
 * fires immediately on mount and no dialog renders.
 */
export function FullPageDiagnostic({
  lines,
  duration = DEFAULT_DURATION_MS,
  onComplete,
}: {
  lines: DiagnosticLine[];
  duration?: number;
  onComplete: () => void;
}) {
  const [visibleLines, setVisibleLines] = useState(0);
  const completedRef = useRef(false);
  const [reduced, setReduced] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }
  }, []);

  const complete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }, [onComplete]);

  // Reduced-motion: skip outright on mount.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      complete();
    }
    // Intentionally empty deps: this only ever runs once per mount; complete
    // is stable enough (memoized via useCallback against onComplete).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stagger the typed-line reveal + schedule auto-completion. Skipped under
  // reduced-motion since the early-return above already called complete.
  useEffect(() => {
    if (reduced) return;
    if (completedRef.current) return;
    const perLine = duration / (lines.length + 1);
    const timers: ReturnType<typeof setTimeout>[] = [];
    lines.forEach((_, i) => {
      timers.push(
        setTimeout(
          () => {
            setVisibleLines((n) => Math.max(n, i + 1));
          },
          perLine * (i + 1),
        ),
      );
    });
    timers.push(setTimeout(complete, duration));
    return () => {
      timers.forEach(clearTimeout);
    };
  }, [duration, lines, reduced, complete]);

  // Skippable via any keydown.
  useEffect(() => {
    if (reduced) return;
    const onKey = () => complete();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [reduced, complete]);

  // Don't render anything under reduced-motion (already completed) or before mount.
  if (reduced || !mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-label={lines[0]?.text ?? 'Pipeline diagnostic'}
      className="fixed inset-0 z-full-page-diagnostic flex items-center justify-center bg-[#0D0B09] text-[#EAD9BC]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_2px,rgba(243,199,105,0.05)_2px,rgba(243,199,105,0.05)_3px)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(243,199,105,0.08)_0%,transparent_70%)]"
      />
      <div className="relative z-10 flex max-w-[640px] flex-col gap-4 px-6 font-mono text-sm">
        <div className="flex flex-col gap-1.5">
          {lines.slice(0, visibleLines).map((l, i) => (
            <div
              key={i}
              className={`flex items-baseline gap-2 ${
                l.emph ? 'text-[#F3C769]' : 'text-[#EAD9BC]'
              }`}
            >
              <span data-fpd-prompt="" aria-hidden="true" className="text-[#F3C769]">
                &gt;
              </span>
              <span className="flex-1">{l.text}</span>
              {l.tag ? (
                <span className="text-[10px] tracking-widest text-[#F3C769]">[{l.tag}]</span>
              ) : null}
            </div>
          ))}
          {visibleLines < lines.length ? (
            <span className="inline-block h-4 w-2 animate-pulse bg-[#F3C769]" aria-hidden="true" />
          ) : null}
        </div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-[#9E8A6B]">
          press any key to skip
        </div>
      </div>
    </div>,
    document.body,
  );
}
