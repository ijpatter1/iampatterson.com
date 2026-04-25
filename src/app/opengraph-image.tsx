import { ImageResponse } from 'next/og';

/**
 * Phase 10d D4 — default Open Graph image.
 *
 * Generated dynamically at request time by Next.js's `ImageResponse`
 * API. Avoids committing a 1200×630 binary asset; the image is the
 * site's editorial signature in compact form (the H1 thesis on a paper
 * background with the persimmon accent).
 *
 * Per-route OG images can override by exporting their own
 * `opengraph-image.tsx` from the route segment. None do today; the
 * default carries every route until launch surfaces a need.
 */
export const runtime = 'edge';
export const contentType = 'image/png';
export const size = { width: 1200, height: 630 };
export const alt = 'Patterson Consulting — measurement infrastructure';

export default function OpengraphImage() {
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
        fontFamily: 'serif',
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
        Patterson Consulting
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          fontSize: 130,
          lineHeight: 1.0,
          color: '#1A1717',
          letterSpacing: '-0.035em',
        }}
      >
        <span>I build</span>
        <span style={{ color: '#C4703A', fontStyle: 'italic' }}>measurement</span>
        <span>infrastructure.</span>
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: 28,
          color: '#5C4A3D',
          maxWidth: '900px',
        }}
      >
        The site itself runs on the same stack I sell.
      </div>
    </div>,
    { ...size },
  );
}
