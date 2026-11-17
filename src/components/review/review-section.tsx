import type { ReactNode } from 'react';

import { SECTION_PADDING_Y, SECTION_TITLE_CLASSES } from '@/components/home/section';

interface ReviewSectionProps {
  tone?: 'paper' | 'alt';
  title: string;
  children: ReactNode;
}

/**
 * A section of the review page (21.1): the homepage's frame and rhythm, opened
 * by a section-size h2 in place of an eyebrow, so a scanning reader finds
 * where each part of the page starts.
 */
export function ReviewSection({ tone = 'paper', title, children }: ReviewSectionProps) {
  return (
    <section className={`${tone === 'alt' ? 'bg-paper-alt' : 'bg-paper'} ${SECTION_PADDING_Y}`}>
      <div className="mx-auto max-w-content px-5 md:px-10">
        <h2 className={SECTION_TITLE_CLASSES}>{title}</h2>
        {children}
      </div>
    </section>
  );
}
