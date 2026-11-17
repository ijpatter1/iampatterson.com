import { ITEM_TITLE_CLASSES } from '@/components/home/section';
import { REVIEW_COLUMNS, type ReviewColumnItem } from '@/lib/content/review';

/**
 * "What you give me, and what you get" (21.1): the give column as a short
 * list, and the get column as a boxed checklist, each item the signed
 * sentence with its opening words in bold.
 */
export function GiveGet() {
  const [give, get] = REVIEW_COLUMNS;
  return (
    <div className="mt-7 grid items-start gap-7 md:mt-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-10">
      <div className="border-t border-rule pt-5">
        <h3 className={ITEM_TITLE_CLASSES}>{give.label}</h3>
        <ul className="mt-3 md:mt-5">
          {give.items.map((item) => (
            <li
              key={item.text}
              className="flex gap-3.5 border-b border-rule-soft py-3 text-[15px] leading-[1.6] text-ink-2 last:border-b-0 md:py-3.5 md:text-base"
            >
              <span aria-hidden="true" className="mt-[11px] h-px w-3 flex-none bg-ink" />
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-sm border border-rule bg-paper px-5 pb-1.5 pt-[22px] md:px-8 md:pb-3 md:pt-7">
        <h3 className={ITEM_TITLE_CLASSES}>{get.label}</h3>
        <ul className="mt-3.5 md:mt-5">
          {get.items.map((item: ReviewColumnItem) => {
            const lead = item.lead ?? '';
            return (
              <li
                key={item.text}
                className="flex items-start gap-3.5 border-t border-rule-soft py-3.5 md:gap-4 md:py-4"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-[22px] w-[22px] flex-none text-ink md:h-6 md:w-6"
                >
                  <circle cx="12" cy="12" r="12" fill="currentColor" />
                  <path
                    d="M7 12.5l3 3 7-7"
                    fill="none"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="stroke-paper"
                  />
                </svg>
                <span className="text-[15px] leading-[1.55] text-ink-2 md:text-base">
                  {lead && <strong className="font-semibold text-ink">{lead}</strong>}
                  {item.text.slice(lead.length)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
