import type { ReactNode } from 'react';

import { CARD_TITLE_CLASSES } from '@/components/home/section';
import { REVIEW_PAGE, type IncludeIcon } from '@/lib/content/review-page';

/** Line icons on a 24-unit grid, drawn in the persimmon accent. */
const ICON_PATHS: Record<IncludeIcon, ReactNode> = {
  // A target: what the tracking aims at.
  conversion: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.2" />
    </>
  ),
  // A tag.
  tags: (
    <>
      <path d="M3 3h8.5L21 12.5 12.5 21 3 11.5V3z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </>
  ),
  // Settings sliders.
  attribution: (
    <>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </>
  ),
  // A balance: claims weighed against orders.
  claims: (
    <>
      <path d="M12 4v16M7 20h10M5 7h14" />
      <path d="M5 7l-3 6a3 3 0 0 0 6 0L5 7zM19 7l-3 6a3 3 0 0 0 6 0l-3-6z" />
    </>
  ),
  // A bar chart.
  reporting: (
    <>
      <path d="M3 20h18" />
      <rect x="5" y="12" width="3" height="8" />
      <rect x="10.5" y="6" width="3" height="14" />
      <rect x="16" y="9" width="3" height="11" />
    </>
  ),
  // A wrench.
  team: (
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  ),
};

/** "What it includes" (21.1): six cards, each an icon, a short title and the sentence. */
export function IncludesGrid() {
  return (
    <ul className="mt-6 grid gap-3 md:mt-10 md:grid-cols-3 md:gap-6">
      {REVIEW_PAGE.includes.map((item) => (
        <li
          key={item.icon}
          className="flex gap-4 rounded-sm border border-rule-soft bg-paper p-5 md:block md:p-7"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-7 w-7 flex-none text-persimmon md:h-8 md:w-8"
          >
            {ICON_PATHS[item.icon]}
          </svg>
          <div>
            <h3 className={`md:mt-4 ${CARD_TITLE_CLASSES}`}>{item.title}</h3>
            <p className="mt-1.5 text-[15px] leading-[1.6] text-ink-2 md:mt-2.5">{item.text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
