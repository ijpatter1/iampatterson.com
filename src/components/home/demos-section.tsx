'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

import { trackClickCta } from '@/lib/events/track';

const DEMOS = [
  {
    n: '01',
    href: '/demo/ecommerce',
    type: 'E-Commerce',
    title: 'The Tuna Shop',
    desc: 'A fully instrumented storefront. Browse, add to cart, checkout. Every interaction generates events that flow through the full stack.',
    highlights: [
      'Campaign taxonomy classifies your UTMs with AI',
      'Data-quality assertions validate every event',
      'Shapley vs. last-click attribution side by side',
    ],
  },
  {
    n: '02',
    href: '/demo/subscription',
    type: 'Subscription',
    title: 'Tuna Subscription',
    desc: 'A subscription product from signup to retention. Cohort curves and LTV on the same event infrastructure.',
    highlights: [
      'Cohort retention segmented by acquisition channel',
      'LTV analysis by channel, over time',
      'Multi-touch attribution across the full funnel',
    ],
  },
  {
    n: '03',
    href: '/demo/leadgen',
    type: 'Lead Gen',
    title: 'Tuna Partnerships',
    desc: 'A lead-gen landing page with full-funnel tracking. Consent enforcement, PII handling, and lead scoring happen in real time.',
    highlights: [
      'Deny marketing consent → watch routing change',
      'AI-powered lead scoring classifies inquiries',
      'Weekly narrative reports generated automatically',
    ],
  },
];

export function DemosSection() {
  const [idx, setIdx] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const onScroll = () => {
      const w = el.clientWidth;
      if (w === 0) return;
      const pos = Math.round(el.scrollLeft / (w * 0.82));
      setIdx(Math.min(Math.max(0, pos), DEMOS.length - 1));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <section
      id="demos"
      data-testid="demos-section"
      className="scroll-mt-24 border-t border-rule-soft bg-paper py-20 md:py-28"
    >
      <div className="mx-auto max-w-content px-5 md:px-10">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-5 border-b border-ink pb-5">
          <h2
            className="font-display font-normal text-ink"
            style={{
              fontSize: 'clamp(36px, 5.5vw, 72px)',
              lineHeight: '1',
              letterSpacing: '-0.02em',
              maxWidth: '16ch',
            }}
          >
            Three business models.
            <br />
            Same <em className="text-accent-current">stack</em>.
          </h2>
          <p className="max-w-[30ch] font-mono text-[11px] uppercase tracking-widest text-ink-3">
            Each demo below is a fully functional front-end generating real events.
          </p>
        </div>

        <div
          ref={trackRef}
          data-testid="demos-track"
          className="grid snap-x snap-mandatory grid-flow-col gap-4 overflow-x-auto overflow-y-hidden px-[5vw] pb-3 md:grid-flow-row md:snap-none md:grid-cols-3 md:overflow-visible md:px-0 md:pb-0"
          style={{
            gridAutoColumns: '82vw',
            scrollbarWidth: 'none',
          }}
        >
          {DEMOS.map((d, i) => (
            <Link
              key={d.href}
              href={d.href}
              onClick={() =>
                trackClickCta(
                  `Explore ${d.title}`,
                  `demo-card-${d.type.toLowerCase().replace(/\s/g, '-')}`,
                )
              }
              className="group relative flex snap-start flex-col gap-4 rounded-sm border border-ink bg-paper p-5 transition-all hover:-translate-y-1 hover:bg-paper-alt md:auto-rows-fr"
              style={{ gridAutoColumns: 'unset' }}
            >
              <span className="absolute inset-x-0 top-0 h-1 origin-left scale-x-[0.2] bg-accent-current transition-transform duration-500 group-hover:scale-x-100" />
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-ink-3">
                  <span className="font-medium text-ink">{d.n}</span>
                  {d.type}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-widest text-ink-3">
                  {`0${i + 1}/03`}
                </span>
              </div>
              <h3
                className="font-display text-ink"
                style={{
                  fontSize: 'clamp(28px, 3.5vw, 40px)',
                  lineHeight: '1.02',
                  letterSpacing: '-0.015em',
                }}
              >
                {d.title}
              </h3>
              <p className="text-sm leading-[1.6] text-ink-2">{d.desc}</p>
              <ul className="mt-auto space-y-1.5 border-t border-rule-soft pt-4">
                {d.highlights.map((h) => (
                  <li
                    key={h}
                    className="flex items-start gap-2 text-[13px] leading-[1.5] text-ink-2 before:mt-1.5 before:inline-block before:h-1 before:w-1 before:flex-shrink-0 before:rounded-full before:bg-accent-current before:content-['']"
                  >
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
              <span className="flex items-center justify-between border-t border-rule-soft pt-3 font-mono text-[10px] uppercase tracking-widest text-ink-3">
                Explore
                <span
                  aria-hidden="true"
                  className="text-ink transition-transform group-hover:translate-x-1"
                >
                  →
                </span>
              </span>
            </Link>
          ))}
        </div>

        <div
          data-testid="swipe-hint"
          className="mt-4 flex items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-ink-3 md:hidden"
        >
          <span>SWIPE</span>
          <div className="flex gap-1.5">
            {DEMOS.map((_, i) => (
              <span
                key={i}
                data-testid={`swipe-bar-${i}`}
                data-on={i === idx}
                className={`h-[2px] w-6 rounded-full transition-colors ${
                  i === idx ? 'bg-ink' : 'bg-rule-soft'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
