import { HERO } from '@/lib/content/hero';
import { OG_SIZE, renderOgCard } from '@/lib/seo/og-card';

/**
 * The default share image: the homepage's headline, with its accent on
 * "can count on.". /review overrides it with its own card; the design is
 * shared in src/lib/seo/og-card.tsx.
 */
export const runtime = 'edge';
export const contentType = 'image/png';
export const size = OG_SIZE;
export const alt = `I am Patterson. ${HERO.headlineLines.join(' ')} ${HERO.headlineAccent}`;

export default function OpengraphImage() {
  return renderOgCard({
    lines: HERO.headlineLines,
    accent: HERO.headlineAccent,
    footer: HERO.eyebrowRight,
  });
}
