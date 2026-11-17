import type { ReactNode } from 'react';

import { SECTION_TITLE_CLASSES } from '@/components/home/section';
import { PRINCIPLES } from '@/lib/content/contact';
import type { PrincipleIcon } from '@/lib/content/contact';

const HEADING_ID = 'contact-principles';

/** Line icons on a 24px grid, drawn in the page's accent. */
const ICON_PATHS: Record<PrincipleIcon, ReactNode> = {
  // An eye: the review looks before it changes anything.
  look: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  // A tick in a circle: the build's change is measured.
  measure: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.7 2.7L16.5 9.5" />
    </>
  ),
  // A padlock: what's built stays in the client's accounts.
  own: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="1.5" />
      <path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
    </>
  ),
};

/** "How I work" on /contact (21.2): the three principles as short cards. */
export function PrincipleCards() {
  return (
    <section aria-labelledby={HEADING_ID} className="bg-paper-alt py-14 md:py-[72px]">
      <div className="mx-auto max-w-content px-5 md:px-10">
        <h2 id={HEADING_ID} className={SECTION_TITLE_CLASSES}>
          {PRINCIPLES.title}
        </h2>
        <ul aria-labelledby={HEADING_ID} className="mt-9 grid gap-6 md:grid-cols-3">
          {PRINCIPLES.items.map((principle) => (
            <li
              key={principle.title}
              className="rounded-sm border border-t-2 border-rule-soft border-t-ink bg-paper p-6 md:p-7"
            >
              <svg
                aria-hidden="true"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-accent-current"
              >
                {ICON_PATHS[principle.icon]}
              </svg>
              <h3 className="mt-3.5 font-display text-[26px] font-normal leading-[1.15] text-ink">
                {principle.title}
              </h3>
              <p className="mt-2.5 text-[15px] leading-[1.6] text-ink-2">{principle.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
