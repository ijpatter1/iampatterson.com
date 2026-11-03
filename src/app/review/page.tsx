import { BookButton } from '@/components/review/book-button';
import {
  BODY_CLASSES,
  Eyebrow,
  ITEM_TITLE_CLASSES,
  LABEL_CLASSES,
  LABEL_STRONG_CLASSES,
  PAGE_TITLE_CLASSES,
  SECTION_PADDING_BOTTOM,
  SMALL_BODY_CLASSES,
  STAT_FIGURE_CLASSES,
  Section,
} from '@/components/home/section';
import { REVIEW_COLUMNS } from '@/lib/content/review';
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
                <BookButton />
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

      <Section tone="alt" eyebrow={REVIEW_PAGE.includesEyebrow} eyebrowAs="h2">
        <ol className="grid gap-x-10 gap-y-8 md:grid-cols-3">
          {REVIEW_PAGE.includes.map((item, i) => (
            <li key={item} className="border-t border-ink pt-5">
              <div className={LABEL_CLASSES}>{String(i + 1).padStart(2, '0')}</div>
              <p className={`mt-3 ${BODY_CLASSES}`}>{item}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section eyebrow={REVIEW_PAGE.columnsEyebrow} eyebrowAs="h2">
        <div className="grid gap-x-10 gap-y-8 md:grid-cols-3">
          {REVIEW_COLUMNS.map((column) => (
            <div key={column.label} className="border-t border-rule pt-4">
              <h3 className={`${LABEL_CLASSES} font-normal`}>{column.label}</h3>
              <p className={`mt-3 ${BODY_CLASSES}`}>{column.text}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="alt" eyebrow={REVIEW_PAGE.followsEyebrow} eyebrowAs="h2">
        <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
          {REVIEW_PAGE.follows.map((step) => (
            <div key={step.label} className="border-t border-ink pt-5">
              <h3 className={ITEM_TITLE_CLASSES}>{step.label}</h3>
              <p className={`mt-3 max-w-[52ch] ${BODY_CLASSES}`}>{step.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-12">
          <BookButton />
        </div>
      </Section>
    </main>
  );
}
