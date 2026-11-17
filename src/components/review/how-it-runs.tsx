import { LABEL_CLASSES, SMALL_BODY_CLASSES } from '@/components/home/section';
import { REVIEW_PAGE } from '@/lib/content/review-page';

/**
 * "How it runs" (21.1): the review's five steps on one line, bracketed from
 * access to the written review by the approved turnaround. No step carries a
 * duration. On a phone the line turns vertical and the sentence moves above
 * it, in a box; the reading order stays steps first, then the sentence.
 */
export function HowItRuns() {
  const steps = REVIEW_PAGE.runs;
  return (
    <div className="mt-5 flex flex-col md:mt-12">
      <ol className="order-2 mt-7 md:order-none md:mt-0 md:grid md:grid-cols-5">
        {steps.map((step, i) => {
          const last = i === steps.length - 1;
          return (
            <li
              key={step.label}
              className="relative flex gap-5 pb-[22px] last:pb-0 md:flex-col md:gap-0 md:pb-0 md:pr-6 md:last:pr-0"
            >
              {!last && (
                // The phone's vertical line, from this node to the next.
                <span
                  aria-hidden="true"
                  className="absolute bottom-[-13px] left-[6.5px] top-[13px] w-px bg-rule md:hidden"
                />
              )}
              <div
                aria-hidden="true"
                className="relative mt-1.5 flex h-[14px] w-[14px] flex-none items-center justify-center md:order-2 md:mt-2 md:w-auto md:justify-start"
              >
                {!last && (
                  // The desktop line, from this node across to the next.
                  <span className="absolute -right-6 left-0 top-1/2 hidden h-px bg-rule md:block" />
                )}
                <span
                  className={`relative rounded-full ${
                    last ? 'h-3.5 w-3.5 bg-persimmon' : 'h-2.5 w-2.5 border-2 border-ink bg-paper'
                  }`}
                />
              </div>
              <div className="md:contents">
                {/* The list is ordered; the numeral is for the eye. */}
                <div aria-hidden="true" className={`${LABEL_CLASSES} md:order-1`}>
                  {String(i + 1).padStart(2, '0')}
                </div>
                <h3 className="mt-1 font-display text-[26px] font-normal leading-[1.1] text-ink md:order-3 md:mt-4 md:text-[28px]">
                  {step.label}
                </h3>
                <p className={`mt-1 md:order-4 md:mt-2 ${SMALL_BODY_CLASSES}`}>{step.caption}</p>
              </div>
            </li>
          );
        })}
      </ol>
      {/* The bracket: the turnaround counts from access to the written review. */}
      <div
        aria-hidden="true"
        className="hidden h-3 w-[calc(80%+14px)] border-x border-b border-rule md:mt-7 md:block"
      />
      <p className="order-1 rounded-sm border border-rule bg-paper px-3.5 py-3 font-mono text-xs uppercase leading-[1.6] tracking-[0.14em] text-ink md:order-none md:mt-3.5 md:w-[calc(80%+14px)] md:rounded-none md:border-0 md:bg-transparent md:p-0 md:text-center">
        {REVIEW_PAGE.turnaround}
      </p>
    </div>
  );
}
