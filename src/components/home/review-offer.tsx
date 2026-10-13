'use client';

import { EditorialLink } from '@/components/chrome/editorial-button';
import { REVIEW_HREF } from '@/lib/content/hero';
import { REVIEW } from '@/lib/content/review';
import { trackClickCta } from '@/lib/events/track';

export function ReviewOffer() {
  return (
    <section id="review" className="bg-paper-alt py-16 md:py-24">
      <div className="mx-auto max-w-content px-5 md:px-10">
        <div className="flex flex-wrap gap-x-16 gap-y-10">
          <div className="min-w-[280px] flex-[1.2]">
            <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
              <span
                aria-hidden="true"
                className="inline-block h-1.5 w-1.5 rounded-full bg-accent-current"
              />
              {REVIEW.eyebrow}
            </p>
            <h2 className="mt-4 font-display text-[clamp(40px,5vw,72px)] font-normal leading-[1] tracking-[-0.02em] text-ink">
              {REVIEW.title}
            </h2>
            <p className="mt-5 max-w-[52ch] text-base leading-[1.7] text-ink-2">{REVIEW.body}</p>
            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
              <EditorialLink
                href={REVIEW_HREF}
                variant="solid"
                onClick={() => trackClickCta(REVIEW.cta, 'review')}
              >
                {REVIEW.cta}
              </EditorialLink>
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">
                {REVIEW.priceLine}
              </span>
            </div>
          </div>
          <div className="grid min-w-[280px] flex-1 content-start gap-x-8 gap-y-6 sm:grid-cols-3">
            {REVIEW.columns.map((column) => (
              <div key={column.label} className="border-t border-rule pt-4">
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
                  {column.label}
                </div>
                <p className="mt-2 text-sm leading-[1.6] text-ink-2">{column.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
