'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';

import { useOverlay } from '@/components/overlay/overlay-context';
import { trackClickCta } from '@/lib/events/track';

import { computeBleed, tierClassName, tierFor, type BleedTier } from './pipeline-bleed';
import { PipelineEditorial } from './pipeline-editorial';

const FLICKER_BASE_DELAY_MS = 240;
const FLICKER_BLEED_DELAY_RANGE_MS = 2200;
const FLICKER_DELAY_JITTER_MS = 400;
const FLICKER_BASE_DURATION_MS = 90;
const FLICKER_DURATION_JITTER_MS = 120;

/**
 * Phase 9E D5 — Homepage pipeline section with progressive bleed-through reveal.
 *
 * The outer shell owns the scroll-driven `--bleed` ramp (0..1, anchored to the
 * section's own height — see `computeBleed`), the tier-class state machine
 * (warm > 0.18, hot > 0.55, peak > 0.85 — re-renders only on threshold crossing),
 * and the random flicker burst scheduler that fires once tier ≥ warm. Four
 * absolute-positioned sibling layers (scanlines, phosphor, vignette, RGB
 * sweep) read `var(--bleed)` and animate via the `.pipeline-section.*` rules
 * in `globals.css`. The schematic itself is delegated to `PipelineEditorial`.
 *
 * Reduced-motion gating: the rAF loop, flicker scheduler, stage rotation, CTA
 * halo, and peak jitter are all suppressed. The bleed layers still render but
 * without animations — the section settles into its calm editorial state.
 *
 * IntersectionObserver pauses the rAF loop when the section is fully off-screen,
 * so the cost is bounded to the time the visitor is looking at the surface.
 *
 * Reference: docs/input_artifacts/design_handoff_pipeline/
 */
export function PipelineSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const bleedRef = useRef(0);
  const [bleedTier, setBleedTier] = useState<BleedTier>(0);
  const [flickBurst, setFlickBurst] = useState(false);
  const { open } = useOverlay();

  // Scroll-driven bleed ramp. Writes --bleed imperatively each frame so we
  // re-render React only when the discrete tier class needs to change.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const el = sectionRef.current;
    if (!el) return;

    let alive = true;
    let lastTier: BleedTier | -1 = -1;
    let inView = true; // Default to in-view so SSR-rendered surfaces don't sit dark.
    let rafId: number | null = null;

    const compute = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const h = el.offsetHeight || vh;
      const b = computeBleed(rect.top, vh, h);
      bleedRef.current = b;
      el.style.setProperty('--bleed', b.toFixed(3));
      const t = tierFor(b);
      if (t !== lastTier) {
        lastTier = t;
        setBleedTier(t);
      }
    };

    const tick = () => {
      if (!alive) return;
      compute();
      rafId = window.requestAnimationFrame(tick);
    };

    const startLoop = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(tick);
    };

    const stopLoop = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    // IntersectionObserver gate: pause the loop when fully off-screen so we
    // don't burn rAF frames computing bleed math the visitor can't see.
    let observer: IntersectionObserver | null = null;
    if (typeof window.IntersectionObserver === 'function') {
      observer = new window.IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry) return;
          inView = entry.isIntersecting;
          if (inView) startLoop();
          else stopLoop();
        },
        { rootMargin: '200px 0px' },
      );
      observer.observe(el);
    } else {
      // No IO available — just keep the loop running.
      startLoop();
    }

    return () => {
      alive = false;
      stopLoop();
      observer?.disconnect();
    };
  }, []);

  // Random flicker bursts — only fire at warm or above. More frequent +
  // sharper as bleed grows. Suppressed under reduced-motion.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || bleedTier < 1) return;

    let alive = true;
    let timer: number | null = null;

    const schedule = () => {
      if (!alive) return;
      const b = bleedRef.current;
      const delay =
        FLICKER_BASE_DELAY_MS +
        (1 - b) * FLICKER_BLEED_DELAY_RANGE_MS +
        Math.random() * FLICKER_DELAY_JITTER_MS;
      timer = window.setTimeout(() => {
        if (!alive) return;
        setFlickBurst(true);
        const burstDuration = FLICKER_BASE_DURATION_MS + Math.random() * FLICKER_DURATION_JITTER_MS;
        timer = window.setTimeout(() => {
          if (!alive) return;
          setFlickBurst(false);
          schedule();
        }, burstDuration);
      }, delay);
    };

    schedule();
    return () => {
      alive = false;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [bleedTier]);

  const tierClass = tierClassName(bleedTier);
  const sectionClassName = [
    'pipeline-section bleed-layer relative isolate overflow-hidden border-t border-rule-soft bg-paper py-20 md:py-28',
    flickBurst ? 'flick' : '',
    tierClass,
  ]
    .filter(Boolean)
    .join(' ');

  const handleOpen = () => {
    trackClickCta('Watch it live', 'pipeline_watch_it_live');
    open();
  };

  return (
    <section
      id="pipeline"
      ref={sectionRef}
      data-testid="pipeline-section"
      className={sectionClassName}
      style={{ '--bleed': '0' } as CSSProperties}
    >
      {/* Underside leak layers — sit above paper, under content. All four
          read --bleed via CSS rules in globals.css. */}
      <div data-bleed-layer="scanlines" className="bleed-scanlines" aria-hidden="true" />
      <div data-bleed-layer="phosphor" className="bleed-phosphor" aria-hidden="true" />
      <div data-bleed-layer="vignette" className="bleed-vignette" aria-hidden="true" />
      <div data-bleed-layer="rgb" className="bleed-rgb" aria-hidden="true" />

      <div className="pipeline-shell relative z-[2] mx-auto max-w-content px-5 md:px-10">
        <div className="grid gap-5 md:grid-cols-[2fr_1fr] md:items-end md:gap-15">
          <h2
            className="font-display font-normal text-ink"
            style={{
              fontSize: 'clamp(36px, 5.5vw, 72px)',
              lineHeight: 1,
              letterSpacing: '-0.02em',
            }}
          >
            Your session is
            <br />
            being <em className="text-accent-current italic">measured</em>
            <br />
            right now.
          </h2>
          <p className="p-meta max-w-[42ch] font-mono text-[12px] leading-[1.6] text-ink-2 md:pb-3">
            Every scroll, click, and page view on this site flows through the same measurement
            pipeline I deploy for clients.
            <br />
            <br />
            The events aren&apos;t simulated. The warehouse is real. The dashboards are running.
          </p>
        </div>

        <div className="pv-host relative z-[1] mb-10 mt-12">
          <PipelineEditorial />
        </div>

        <div className="flip-cta-wrap relative z-[2] mt-8 flex justify-center">
          <button
            type="button"
            onClick={handleOpen}
            className="bleed-cta inline-flex items-center gap-2 rounded-full border border-ink bg-paper px-4 py-2 font-sans text-[14px] font-medium text-ink transition-all"
          >
            <span className="flip-icon" aria-hidden="true">
              ↻
            </span>
            <span className="flip-label">Watch it live</span>
            <span className="flip-nudge font-mono uppercase tracking-[0.14em]" aria-hidden="true">
              flip →
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}
