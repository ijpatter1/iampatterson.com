'use client';

import Link from 'next/link';

import { EditorialLink } from '@/components/chrome/editorial-button';
import {
  ITEM_TITLE_CLASSES,
  LABEL_CLASSES,
  LABEL_STRONG_CLASSES,
  SECTION_TITLE_CLASSES,
  SMALL_BODY_CLASSES,
  STEP_LINE_CLASSES,
  Section,
} from '@/components/home/section';
import { REVIEW_HREF } from '@/lib/content/hero';
import { HOW_WE_WORK } from '@/lib/content/review';
import { trackClickCta } from '@/lib/events/track';

/** "How teams work with me": Review, Build, Lead, as on the LinkedIn banner. */
export function HowWeWork() {
  return (
    <Section id="review" eyebrow={HOW_WE_WORK.eyebrow}>
      <h2 className={SECTION_TITLE_CLASSES}>{HOW_WE_WORK.title}</h2>

      <ol className="mt-10 grid gap-x-10 gap-y-10 md:grid-cols-3">
        {HOW_WE_WORK.steps.map((step) => (
          <li key={step.num} className="flex flex-col border-t border-ink pt-5">
            <h3 className={ITEM_TITLE_CLASSES}>
              <span className={`block ${LABEL_CLASSES}`}>{step.num}</span>{' '}
              <span className="mt-3 block">{step.label}</span>
            </h3>
            <p className={`mt-3 ${STEP_LINE_CLASSES}`}>{step.line}</p>
            <p className={`mt-4 ${SMALL_BODY_CLASSES}`}>{step.body}</p>
            {(step.price || step.link) && (
              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
                {step.price && <span className={LABEL_STRONG_CLASSES}>{step.price}</span>}
                {step.link && (
                  <Link
                    href={step.link.href}
                    className={`${LABEL_CLASSES} inline-flex min-h-[44px] items-center underline decoration-rule underline-offset-4 transition-colors hover:text-ink`}
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
    </Section>
  );
}
