'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';

import { useOverlay } from '@/components/overlay/overlay-context';
import { trackClickCta } from '@/lib/events/track';

import { computeBleed, tierClassName, tierFor, type BleedTier } from './pipeline-bleed';
import { hasPipelineBleedConsumed } from './pipeline-bleed-consumed';
import { PipelineEditorial } from './pipeline-editorial';

const FLICKER_BASE_DELAY_MS = 240;
const FLICKER_BLEED_DELAY_RANGE_MS = 2200;
const FLICKER_DELAY_JITTER_MS = 400;
const FLICKER_BASE_DURATION_MS = 90;
const FLICKER_DURATION_JITTER_MS = 120;

/**
 * Phase 9E D5, Homepage pipeline section with progressive bleed-through reveal.
 *
 * The outer shell owns the scroll-driven `--bleed` ramp (0..1, anchored to the
 * section's own height, see `computeBleed`), the tier-class state machine
 * (warm > 0.18, hot > 0.55, peak > 0.85, re-renders only on threshold crossing),
 * and the random flicker burst scheduler that fires once tier ≥ warm. Four
 * absolute-positioned sibling layers (scanlines, phosphor, vignette, RGB
 * sweep) read `var(--bleed)` and animate via the `.pipeline-section.*` rules
 * in `globals.css`. The schematic itself is delegated to `PipelineEditorial`.
 *
 * Reduced-motion gating: the rAF loop, flicker scheduler, stage rotation, CTA
 * halo, and peak jitter are all suppressed. The bleed layers still render but
 * without animations, the section settles into its calm editorial state.
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
  const { open, isOpen } = useOverlay();

  // Scroll-driven bleed ramp. Writes --bleed imperatively each frame so we
  // re-render React only when the discrete tier class needs to change.
  //
  // F6 UAT close-out: once the visitor has opened the overlay (any tab)
  // this session, the bleed reveal is consumed, pipeline-section
  // renders in its calm editorial baseline on subsequent scroll. The
  // priming gesture has done its job; repeating on every scroll is
  // wallpaper.
  //
  // Effect subscribes to `isOpen` so the flag re-reads on every overlay
  // open/close edge. When the overlay opens (OverlayProvider writes the
  // flag in the same tick), this effect re-runs, sees the now-set flag,
  // and the previous-effect cleanup tears down the rAF loop. Without
  // this subscription the loop would keep running after the first
  // overlay close (UAT F6 follow-up).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hasPipelineBleedConsumed()) return;
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const el = sectionRef.current;
    if (!el) return;

    let alive = true;
    let lastTier: BleedTier | -1 = -1;
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
          if (entry.isIntersecting) startLoop();
          else stopLoop();
        },
        { rootMargin: '200px 0px' },
      );
      observer.observe(el);
    } else {
      // No IO available, just keep the loop running.
      startLoop();
    }

    return () => {
      alive = false;
      stopLoop();
      observer?.disconnect();
    };
  }, [isOpen]);

  // Random flicker bursts, only fire at warm or above. More frequent +
  // sharper as bleed grows. Suppressed under reduced-motion AND once
  // the bleed reveal is consumed (pipeline section has primed the
  // visitor once; subsequent scrolls stay calm per F6 UAT). Subscribes
  // to `isOpen` for the same re-evaluation edge as the rAF loop above.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hasPipelineBleedConsumed()) return;
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
  }, [bleedTier, isOpen]);

  // Visual reset when the bleed is consumed mid-ramp (UAT F6 follow-up).
  // The rAF loop tear-down above stops NEW frames but leaves the last
  // `--bleed` value frozen on the section + `bleedTier` frozen in React
  // state. Without this effect, closing the overlay at peak bleed would
  // leave the section stuck in the amber-flooded peak state until a
  // page reload. On overlay-open edge, reset CSS var to 0, tier to 0,
  // flick to false, section returns to its calm editorial baseline.
  //
  // Why the disable: this effect synchronises React state (bleedTier,
  // flickBurst) with an external system (the DOM `--bleed` CSS var +
  // the consumed-bleed flag in sessionStorage). The React setState
  // calls and the DOM write are intentionally coupled: they reset the
  // editorial baseline together on overlay-open-edge. Decoupling into
  // a key-prop remount would churn the whole section's render tree
  // for a cosmetic reset.
  useEffect(() => {
    if (!isOpen) return;
    if (!hasPipelineBleedConsumed()) return;
    const el = sectionRef.current;
    if (el) el.style.setProperty('--bleed', '0');
    bleedRef.current = 0;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- external-system sync (see comment above)
    setBleedTier(0);
    setFlickBurst(false);
  }, [isOpen]);

  const tierClass = tierClassName(bleedTier);
  // Spec calls for asymmetric padding (80px top / 100px bottom) so the
  // CTA gets editorial gravity at the close, matches design handoff
  // pipeline_section.css `padding: 80px 0 100px`. Honor the asymmetry
  // at every viewport: pt-20 = 80px top everywhere, pb-[100px] = 100px
  // bottom everywhere. (Earlier `md:pt-28` carried over from the
  // pre-D5 symmetric padding and broke spec on desktop.)
  // F6 follow-up, mobile length compression. Section shrinks to
  // pt-12 pb-16 on <md; desktop keeps the spec's 80/100 asymmetry.
  const sectionClassName = [
    'pipeline-section bleed-layer relative isolate overflow-hidden border-t border-rule-soft bg-paper pt-12 pb-16 md:pt-20 md:pb-[100px]',
    flickBurst ? 'flick' : '',
    tierClass,
  ]
    .filter(Boolean)
    .join(' ');

  const handleOpen = () => {
    trackClickCta('See your session', 'pipeline_see_your_session');
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
      {/* Underside leak layers, sit above paper, under content. All four
          read --bleed via CSS rules in globals.css. */}
      <div data-bleed-layer="scanlines" className="bleed-scanlines" aria-hidden="true" />
      <div data-bleed-layer="phosphor" className="bleed-phosphor" aria-hidden="true" />
      <div data-bleed-layer="vignette" className="bleed-vignette" aria-hidden="true" />
      <div data-bleed-layer="rgb" className="bleed-rgb" aria-hidden="true" />

      <div className="pipeline-shell relative z-[2] mx-auto max-w-content px-5 md:px-10">
        <h2
          className="font-display font-normal text-ink"
          style={{
            // F6 follow-up, mobile floor 36px → 28px so the 3-line
            // display reflows at ~84px on 360px (was ~108px).
            fontSize: 'clamp(28px, 5.5vw, 72px)',
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}
        >
          The pipeline,
          <br />
          <em className="text-accent-current italic">running</em>.
        </h2>

        <div className="pv-host relative z-[1] mb-6 mt-8 md:mb-10 md:mt-12">
          <PipelineEditorial />
        </div>

        <div className="flip-cta-wrap relative z-[2] mt-6 flex justify-center md:mt-8">
          <button
            type="button"
            onClick={handleOpen}
            className="bleed-cta inline-flex items-center gap-2 rounded-full border border-ink bg-paper px-5 py-2 font-sans text-[14px] font-medium text-ink transition-all"
          >
            <span className="flip-label">See your session</span>
            <span className="flip-nudge font-mono" aria-hidden="true">
              →
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}
