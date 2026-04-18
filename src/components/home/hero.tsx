'use client';

import { EditorialButton, EditorialLink } from '@/components/chrome/editorial-button';
import { useOverlay } from '@/components/overlay/overlay-context';
import { trackClickCta } from '@/lib/events/track';

export function HeroEditorial() {
  const { open } = useOverlay();

  const handleOpen = () => {
    trackClickCta('Look under the hood', 'hero');
    open();
  };

  return (
    <section className="bg-paper pt-8 pb-20 md:pt-12 md:pb-28">
      <div className="mx-auto max-w-content px-5 md:px-10">
        <h1
          className="font-display font-normal text-ink"
          style={{
            fontSize: 'clamp(56px, 13vw, 200px)',
            lineHeight: '0.88',
            letterSpacing: '-0.035em',
          }}
        >
          I build
          <br />
          <em className="text-accent-current">measurement</em>
          <br />
          infrastructure.
        </h1>

        <div className="mt-12 grid gap-8 border-t border-rule-soft pt-8 md:grid-cols-[1fr_1.8fr] md:gap-16">
          <p
            className="font-display italic text-ink"
            style={{
              fontSize: 'clamp(22px, 2.6vw, 34px)',
              lineHeight: '1.25',
            }}
          >
            This site runs on the same stack I sell — consent, sGTM, BigQuery, Dataform, live
            dashboards. Instead of describing it, I built on it.
          </p>
          <div>
            <p className="max-w-[52ch] text-base leading-[1.7] text-ink-2">
              Most consultants describe what they build. I&apos;d rather you watch it run. Every
              scroll, every click on this page flows through a real server-side tag manager, into a
              real warehouse, through a real transformation pipeline — live on your session, right
              now. The instrumentation is the portfolio.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <EditorialButton variant="accent" onClick={handleOpen}>
                Look under the hood →
              </EditorialButton>
              <EditorialLink
                href="/#demos"
                variant="ghost"
                onClick={() => trackClickCta('Explore the demos', 'hero')}
              >
                Explore the demos
              </EditorialLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
