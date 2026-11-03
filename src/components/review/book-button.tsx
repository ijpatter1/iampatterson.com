'use client';

import { EditorialLink } from '@/components/chrome/editorial-button';
import { BOOK_REVIEW_HREF } from '@/lib/content/review';
import { REVIEW_PAGE } from '@/lib/content/review-page';
import { trackClickCta } from '@/lib/events/track';

/** "Book the review": to the contact page with the review intent, tracked. */
export function BookButton() {
  return (
    <EditorialLink
      href={BOOK_REVIEW_HREF}
      variant="solid"
      onClick={() => trackClickCta(REVIEW_PAGE.cta, 'review')}
    >
      {REVIEW_PAGE.cta}
    </EditorialLink>
  );
}
