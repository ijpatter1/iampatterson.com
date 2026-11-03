'use client';

import { EditorialButton, EditorialLink } from '@/components/chrome/editorial-button';
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
    <section className="bg-paper pb-16 pt-4 md:pb-28 md:pt-12">
      <div className="mx-auto max-w-content px-5 md:px-10">
        <div className="flex flex-wrap justify-between gap-x-6 gap-y-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
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

        <div className="mt-6 border-t border-rule-soft pt-6 md:mt-12 md:pt-8">
          <p className="max-w-[40ch] font-display text-[clamp(22px,2.4vw,32px)] italic leading-[1.28] text-ink">
            {HERO.kicker}
          </p>
          <div className="mt-6 flex flex-wrap gap-3 md:mt-8">
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
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
            {HERO.capacityNote}
          </p>
        </div>
      </div>
    </section>
  );
}
