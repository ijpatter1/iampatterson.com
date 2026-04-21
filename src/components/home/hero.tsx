'use client';

import { EditorialButton, EditorialLink } from '@/components/chrome/editorial-button';
import { useOverlay } from '@/components/overlay/overlay-context';
import { trackClickCta } from '@/lib/events/track';

export function HeroEditorial() {
  const { open } = useOverlay();

  const handleOpen = () => {
    trackClickCta('See your session', 'hero');
    open();
  };

  return (
    <section className="bg-paper pt-4 pb-16 md:pt-12 md:pb-28">
      <div className="mx-auto max-w-content px-5 md:px-10">
        <h1
          className="font-display font-normal text-ink"
          style={{
            // F5 UAT S11, shrink mobile floor 56px → 44px so the headline
            // takes ~33px less vertical space on 360px, putting CTAs
            // within the 667px iPhone SE fold.
            fontSize: 'clamp(44px, 13vw, 200px)',
            lineHeight: '0.9',
            letterSpacing: '-0.035em',
          }}
        >
          I build
          <br />
          <em className="text-accent-current">measurement</em>
          <br />
          infrastructure.
        </h1>

        <div className="mt-6 grid gap-6 border-t border-rule-soft pt-6 md:mt-12 md:grid-cols-[1fr_1.8fr] md:gap-16 md:pt-8">
          <p
            className="font-display italic text-ink"
            style={{
              // Mobile italic kicker: 18px (was 22px) so 3 lines of
              // supporting prose fit in ~68px, not ~88px.
              fontSize: 'clamp(18px, 2.6vw, 34px)',
              lineHeight: '1.25',
            }}
          >
            This site runs on the same stack I sell, consent, sGTM, BigQuery, Dataform, live
            dashboards. Instead of describing it, I built on it.
          </p>
          <div>
            <p className="max-w-[52ch] text-[15px] leading-[1.65] text-ink-2 md:text-base md:leading-[1.7]">
              Most consultants describe what they build. I&apos;d rather you watch it run. Every
              scroll, every click on this page flows through a real server-side tag manager, into a
              real warehouse, through a real transformation pipeline, live on your session, right
              now. The instrumentation is the portfolio.
            </p>
            <div className="mt-5 flex flex-wrap gap-3 md:mt-7">
              <EditorialButton variant="accent" onClick={handleOpen}>
                See your session →
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
