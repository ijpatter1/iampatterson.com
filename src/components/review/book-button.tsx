'use client';

import { EditorialLink } from '@/components/chrome/editorial-button';
import { BOOK_REVIEW_HREF } from '@/lib/content/review';
import { REVIEW_PAGE } from '@/lib/content/review-page';
import type { CtaLocation } from '@/lib/events/schema';
import { trackClickCta } from '@/lib/events/track';

interface BookButtonProps {
  /** The page has two of these; each reports its own place. */
  ctaLocation: Extract<CtaLocation, 'review_page_top' | 'review_page_bottom'>;
}

/** "Book the review": to the contact page with the review intent, tracked. */
export function BookButton({ ctaLocation }: BookButtonProps) {
  return (
    <EditorialLink
      href={BOOK_REVIEW_HREF}
      variant="solid"
      onClick={() => trackClickCta(REVIEW_PAGE.cta, ctaLocation)}
    >
      {REVIEW_PAGE.cta}
    </EditorialLink>
  );
}
