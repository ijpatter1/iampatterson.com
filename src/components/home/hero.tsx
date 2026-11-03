'use client';

import { EditorialButton, EditorialLink } from '@/components/chrome/editorial-button';
import { EYEBROW_CLASSES, LABEL_CLASSES, SECTION_PADDING_BOTTOM } from '@/components/home/section';
import { useOverlay } from '@/components/overlay/overlay-context';
import { HERO, REVIEW_HREF } from '@/lib/content/hero';
import { trackClickCta } from '@/lib/events/track';

export function HeroEditorial() {
  const { open } = useOverlay();

  const handleOpen = () => {
    trackClickCta(HERO.ghostCta, 'hero');
    open();
  };

  return (
    <section className={`bg-paper pt-4 md:pt-12 ${SECTION_PADDING_BOTTOM}`}>
      <div className="mx-auto max-w-content px-5 md:px-10">
        <div className={`flex flex-wrap justify-between gap-x-6 gap-y-1 ${EYEBROW_CLASSES}`}>
          <span>{HERO.eyebrowLeft}</span>
          <span>{HERO.eyebrowRight}</span>
        </div>

        {/* Each line stays unbroken. The size floor keeps "marketing team"
            inside a 390px screen and the primary CTA inside a 667px viewport. */}
        <h1 className="mt-6 font-display text-[clamp(64px,9vw,140px)] font-normal leading-[0.92] tracking-[-0.035em] text-ink md:mt-10">
          {HERO.headlineLines.map((line) => (
            <span key={line}>
              <span className="block whitespace-nowrap">{line}</span>{' '}
            </span>
          ))}
          <span className="block whitespace-nowrap">
            <em className="text-accent-current">{HERO.headlineAccent}</em>
          </span>
        </h1>

        {/* From lg up the calls to action sit in a column beside the kicker, as
            in the design reference, so "Start with a review" stays above the
            fold on laptop screens down to 1280 by 720. */}
        <div className="mt-6 border-t border-rule-soft pt-6 md:mt-12 md:pt-8 lg:flex lg:items-start lg:justify-between lg:gap-x-16">
          <p className="max-w-[40ch] font-display text-[clamp(22px,2.4vw,32px)] italic leading-[1.28] text-ink">
            {HERO.kicker}
          </p>
          <div className="lg:shrink-0">
            <div className="mt-6 flex flex-wrap gap-3 md:mt-8 lg:mt-0 lg:flex-col lg:items-start">
              <EditorialLink
                href={REVIEW_HREF}
                variant="solid"
                onClick={() => trackClickCta(HERO.primaryCta, 'hero')}
              >
                {HERO.primaryCta}
              </EditorialLink>
              <EditorialButton variant="ghost" onClick={handleOpen}>
                {HERO.ghostCta} →
              </EditorialButton>
            </div>
            <p className={`mt-4 ${LABEL_CLASSES}`}>{HERO.capacityNote}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
