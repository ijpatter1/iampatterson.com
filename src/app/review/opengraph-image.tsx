import { ImageResponse } from 'next/og';

/**
 * The review page's share image (15.10), in the default image's design.
 *
 * Generated dynamically at request time by Next.js's `ImageResponse`
 * API. Avoids committing a 1200×630 binary asset; the image is the
 * site's editorial signature in compact form (the H1 thesis on a paper
 * background with the persimmon accent).
 *
 * Loads Instrument Serif (regular + italic) from `public/fonts/` so
 * the social-graph rendering carries the actual brand typography
 * rather than the edge runtime's fallback `serif`. The italic accent
 * on "can count on." is a load-bearing visual signature; rendering it
 * in fallback Times-italic loses the editorial character that makes
 * the homepage feel intentional.
 *
 * Per-route OG images can override by exporting their own
 * `opengraph-image.tsx` from the route segment. None do today; the
 * default carries every route until launch surfaces a need.
 */
export const runtime = 'edge';
export const contentType = 'image/png';
export const size = { width: 1200, height: 630 };
export const alt = 'Start with a review. From $2,500. I am Patterson.';

export default async function OpengraphImage() {
  const [regular, italic] = await Promise.all([
    fetch(new URL('../../../public/fonts/instrument-serif.ttf', import.meta.url)).then((r) =>
      r.arrayBuffer(),
    ),
    fetch(new URL('../../../public/fonts/instrument-serif-italic.ttf', import.meta.url)).then((r) =>
      r.arrayBuffer(),
    ),
  ]);

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '80px',
        background: '#FAF7F0',
        fontFamily: 'Instrument Serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          fontSize: 24,
          color: '#5C4A3D',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
        }}
      >
        I am Patterson
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          fontSize: 116,
          lineHeight: 1.0,
          color: '#1A1717',
          letterSpacing: '-0.035em',
        }}
      >
        <span>Start with</span>
        <span style={{ color: '#C4703A', fontStyle: 'italic' }}>a review.</span>
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: 28,
          color: '#5C4A3D',
          maxWidth: '900px',
        }}
      >
        From $2,500 · iampatterson.com/review
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: 'Instrument Serif', data: regular, style: 'normal', weight: 400 },
        { name: 'Instrument Serif', data: italic, style: 'italic', weight: 400 },
      ],
    },
  );
}
