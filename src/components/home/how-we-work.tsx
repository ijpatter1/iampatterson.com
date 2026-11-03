'use client';

import Link from 'next/link';

import { EditorialLink } from '@/components/chrome/editorial-button';
import { REVIEW_HREF } from '@/lib/content/hero';
import { HOW_WE_WORK } from '@/lib/content/review';
import { trackClickCta } from '@/lib/events/track';

const monoClasses = 'font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3';

/** "How teams work with me": Review, Build, Lead, as on the LinkedIn banner. */
export function HowWeWork() {
  return (
    <section id="review" className="bg-paper-alt py-16 md:py-24">
      <div className="mx-auto max-w-content px-5 md:px-10">
        <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
          <span
            aria-hidden="true"
            className="inline-block h-1.5 w-1.5 rounded-full bg-accent-current"
          />
          {HOW_WE_WORK.eyebrow}
        </p>
        <h2 className="mt-4 font-display text-[clamp(40px,5vw,72px)] font-normal leading-[1] tracking-[-0.02em] text-ink">
          {HOW_WE_WORK.title}
        </h2>

        <ol className="mt-10 grid gap-x-10 gap-y-10 md:grid-cols-3">
          {HOW_WE_WORK.steps.map((step) => (
            <li key={step.num} className="flex flex-col border-t border-ink pt-5">
              <h3 className="flex items-baseline gap-3 font-display text-[32px] font-normal leading-none text-ink">
                <span className="font-mono text-[11px] tracking-[0.14em] text-ink-3">
                  {step.num}
                </span>{' '}
                {step.label}
              </h3>
              <p className="mt-3 font-display text-xl italic leading-snug text-ink">{step.line}</p>
              <p className="mt-4 text-sm leading-[1.7] text-ink-2">{step.body}</p>
              {(step.price || step.link) && (
                <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
                  {step.price && (
                    <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink">
                      {step.price}
                    </span>
                  )}
                  {step.link && (
                    <Link
                      href={step.link.href}
                      className={`${monoClasses} inline-flex min-h-[44px] items-center underline decoration-rule underline-offset-4 transition-colors hover:text-ink`}
                      onClick={() => trackClickCta(step.link!.text, 'review')}
                    >
                      {step.link.text}
                      <span aria-hidden="true">&nbsp;→</span>
                    </Link>
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>

        <div className="mt-12">
          <EditorialLink
            href={REVIEW_HREF}
            variant="solid"
            onClick={() => trackClickCta(HOW_WE_WORK.cta, 'review')}
          >
            {HOW_WE_WORK.cta}
          </EditorialLink>
        </div>
      </div>
    </section>
  );
}
