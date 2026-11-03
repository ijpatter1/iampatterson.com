import { REVIEW_PRICE } from '@/lib/content/review';
import { OG_SIZE, renderOgCard } from '@/lib/seo/og-card';

/** The review page's share image (15.10), in the shared card design. */
export const runtime = 'edge';
export const contentType = 'image/png';
export const size = OG_SIZE;
export const alt = `Start with a review. From ${REVIEW_PRICE}. I am Patterson.`;

export default function ReviewOpengraphImage() {
  return renderOgCard({
    lines: ['Start with'],
    accent: 'a review.',
    footer: `From ${REVIEW_PRICE} · iampatterson.com/review`,
  });
}
