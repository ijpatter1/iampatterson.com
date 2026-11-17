import {
  BODY_CLASSES,
  Eyebrow,
  ITEM_TITLE_CLASSES,
  LABEL_STRONG_CLASSES,
  PAGE_TITLE_CLASSES,
  SECTION_PADDING_BOTTOM,
  SMALL_BODY_CLASSES,
  STAT_FIGURE_CLASSES,
} from '@/components/home/section';
import { BookButton } from '@/components/review/book-button';
import { GiveGet } from '@/components/review/give-get';
import { HowItRuns } from '@/components/review/how-it-runs';
import { IncludesGrid } from '@/components/review/includes-grid';
import { ReviewSection } from '@/components/review/review-section';
import { REVIEW_PAGE } from '@/lib/content/review-page';

/** The review page: the profile's Featured item "Start with a review". */
export default function ReviewPage() {
  return (
    <main>
      <section className={`bg-paper pt-8 md:pt-16 ${SECTION_PADDING_BOTTOM}`}>
        <div className="mx-auto max-w-content px-5 md:px-10">
          <Eyebrow>{REVIEW_PAGE.eyebrow}</Eyebrow>
          <h1 className={`mt-5 ${PAGE_TITLE_CLASSES}`}>{REVIEW_PAGE.title}</h1>
          <div className="mt-10 flex flex-wrap items-start gap-x-16 gap-y-10 border-t border-rule-soft pt-8">
            {/* The button sits under the intro, so it is above the fold (Ian, 2026-11-03). */}
            <div className="min-w-[280px] max-w-[52ch] flex-[1.3]">
              <p className={`${BODY_CLASSES} md:text-lg`}>{REVIEW_PAGE.intro}</p>
              <div className="mt-6">
                <BookButton ctaLocation="review_page_top" />
              </div>
            </div>
            <div className="min-w-[260px] flex-1">
              <div className={STAT_FIGURE_CLASSES}>{REVIEW_PAGE.price}</div>
              <p className={`mt-4 max-w-[42ch] ${SMALL_BODY_CLASSES}`}>{REVIEW_PAGE.scope}</p>
              <p className={`mt-3 max-w-[42ch] ${LABEL_STRONG_CLASSES}`}>
                {REVIEW_PAGE.turnaround}
              </p>
            </div>
          </div>
        </div>
      </section>

      <ReviewSection tone="alt" title={REVIEW_PAGE.includesTitle}>
        <IncludesGrid />
      </ReviewSection>

      <ReviewSection title={REVIEW_PAGE.columnsTitle}>
        <GiveGet />
      </ReviewSection>

      <ReviewSection tone="alt" title={REVIEW_PAGE.runsTitle}>
        <HowItRuns />
      </ReviewSection>

      <ReviewSection title={REVIEW_PAGE.followsTitle}>
        <div className="mt-7 grid gap-x-10 gap-y-8 md:mt-10 md:grid-cols-2">
          {REVIEW_PAGE.follows.map((step) => (
            <div key={step.label} className="border-t border-ink pt-5">
              <h3 className={ITEM_TITLE_CLASSES}>{step.label}</h3>
              <p className={`mt-3 max-w-[52ch] ${BODY_CLASSES}`}>{step.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-12">
          <BookButton ctaLocation="review_page_bottom" />
        </div>
      </ReviewSection>
    </main>
  );
}
