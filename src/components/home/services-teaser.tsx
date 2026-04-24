'use client';

import Link from 'next/link';

import { TIERS } from '@/lib/content/tiers';
import { trackClickNav } from '@/lib/events/track';

/**
 * Homepage teaser for the Services page. Each tier row deep-links to the
 * matching `/services#tier-NN` anchor (Phase 10d D8.d) so visitors land on
 * the tier they clicked rather than at the top of the services page.
 * Uses the first sentence of the tier lede as the row description.
 */
export function ServicesTeaser() {
  return (
    <section
      data-testid="services-teaser"
      className="border-t border-rule-soft bg-paper py-20 md:py-28"
    >
      <div className="mx-auto max-w-content px-5 md:px-10">
        <span className="block font-mono text-[10px] uppercase tracking-widest text-ink-3">
          What I build · Four tiers
        </span>
        <h2
          className="mt-5 max-w-[20ch] font-display font-normal text-ink"
          style={{
            fontSize: 'clamp(40px, 6.5vw, 88px)',
            lineHeight: '1',
            letterSpacing: '-0.02em',
          }}
        >
          End-to-end measurement infrastructure. <em className="text-accent-current">Not</em> just
          another tag implementation.
        </h2>

        <ul className="mt-12 border-t border-ink">
          {TIERS.map((t) => {
            const firstSentence = t.lede.split('.')[0] + '.';
            const href = `/services#tier-${t.num}`;
            return (
              <li key={t.num} className="border-b border-rule-soft">
                <Link
                  href={href}
                  onClick={() => trackClickNav(`Tier ${t.num} ${t.title}`, href)}
                  className="group grid grid-cols-[auto_1fr_auto] items-baseline gap-4 py-6 md:grid-cols-[120px_220px_1fr_auto] md:gap-8 md:py-8"
                >
                  <span className="font-mono text-[11px] uppercase tracking-widest text-ink-3">
                    TIER {t.num}
                  </span>
                  <span
                    className="col-span-2 font-display text-2xl text-ink md:col-span-1"
                    style={{
                      fontSize: 'clamp(22px, 2.6vw, 32px)',
                      lineHeight: '1.1',
                    }}
                  >
                    {t.title}
                  </span>
                  <span className="col-span-3 text-sm leading-[1.6] text-ink-2 md:col-span-1">
                    <span className="italic text-ink">{t.subtitle}</span> {firstSentence}
                  </span>
                  <span className="col-span-3 justify-self-start font-mono text-[10px] uppercase tracking-widest text-ink-3 transition-colors group-hover:text-accent-current md:col-span-1 md:justify-self-end">
                    See scope →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
