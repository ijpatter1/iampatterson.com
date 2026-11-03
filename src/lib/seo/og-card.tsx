import { ImageResponse } from 'next/og';

/**
 * The site's share-image card: the I am Patterson label, a headline whose
 * last line is the persimmon italic accent, and a footer line, set in
 * Instrument Serif on paper. Each route's opengraph-image.tsx passes its own
 * lines; the design lives here once.
 */
export const OG_SIZE = { width: 1200, height: 630 };

interface OgCard {
  lines: readonly string[];
  accent: string;
  footer: string;
}

export async function renderOgCard({ lines, accent, footer }: OgCard) {
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
        {lines.map((line) => (
          <span key={line}>{line}</span>
        ))}
        <span style={{ color: '#C4703A', fontStyle: 'italic' }}>{accent}</span>
      </div>
      <div style={{ display: 'flex', fontSize: 28, color: '#5C4A3D', maxWidth: '900px' }}>
        {footer}
      </div>
    </div>,
    {
      ...OG_SIZE,
      fonts: [
        { name: 'Instrument Serif', data: regular, style: 'normal', weight: 400 },
        { name: 'Instrument Serif', data: italic, style: 'italic', weight: 400 },
      ],
    },
  );
}
