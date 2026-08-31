import { ImageResponse } from 'next/og';

import { SHARE_URL_MAX } from '@/lib/claudish/limits';
import { decodeShare } from '@/lib/claudish/share-codec';

import type { DecodedShare } from '@/lib/claudish/share-codec';

/**
 * Dynamic share card: both panels of the translation at 1200×630 with
 * the site URL (screenshots must carry it). Content-addressed by ?t=, so
 * the response is immutable-cacheable — unfurlers hammer this endpoint.
 * Every failure path (missing/garbage/oversized t, decode throw, font
 * fetch failure) returns the generic card rather than an error: an
 * unfurler that sees a 500 shows nothing, which kills the share loop.
 * No Google trade dress anywhere on the card.
 *
 * Structure note: all data work (URL parse, decode, font fetch) happens
 * in prepare() under try/catch; JSX assembly lives outside any try/catch
 * (react-hooks/error-boundaries), with a module-level minimal element as
 * the last-resort card should ImageResponse itself throw.
 */
export const runtime = 'edge';

const SIZE = { width: 1200, height: 630 };
const CACHE_HEADERS = {
  'Cache-Control': 'public, immutable, no-transform, max-age=31536000',
};

/** Panel excerpt: the card is a poster, not a document. */
function excerpt(text: string, max = 320): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

/** Everything fallible, no JSX: returns nulls instead of throwing. */
async function prepare(
  request: Request
): Promise<{ share: DecodedShare | null; fonts: ArrayBuffer | null }> {
  let fonts: ArrayBuffer | null = null;
  let share: DecodedShare | null = null;
  try {
    fonts = await fetch(
      new URL('../../../../public/fonts/roboto-latin-400.ttf', import.meta.url)
    ).then((r) => r.arrayBuffer());
  } catch {
    fonts = null; // ImageResponse falls back to its bundled default font
  }
  try {
    const t = new URL(request.url).searchParams.get('t');
    // Length gate first: hostile input never reaches the decompressor.
    share = t && t.length <= SHARE_URL_MAX ? decodeShare(t) : null;
  } catch {
    share = null;
  }
  return { share, fonts };
}

const LAST_RESORT_ELEMENT = (
  <div
    style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#ffffff',
    }}
  >
    <span style={{ display: 'flex', fontSize: 64, color: '#202124' }}>
      Claudish · iampatterson.com
    </span>
  </div>
);

function frame(children: React.ReactNode, fonts: ArrayBuffer | null) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#ffffff',
        padding: 48,
        fontFamily: fonts ? 'Roboto' : 'sans-serif',
      }}
    >
      {children}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 'auto',
          paddingTop: 24,
          borderTop: '1px solid #dadce0',
          color: '#5f6368',
          fontSize: 24,
        }}
      >
        <span>Claudish Translate</span>
        <span>A toy by Ian Patterson · iampatterson.com</span>
      </div>
    </div>
  );
}

function panel(label: string, text: string, tint: string) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        backgroundColor: tint,
        border: '1px solid #dadce0',
        borderRadius: 12,
        padding: 28,
        gap: 12,
      }}
    >
      <span
        style={{
          display: 'flex',
          fontSize: 20,
          letterSpacing: 2,
          textTransform: 'uppercase',
          color: '#1a73e8',
        }}
      >
        {label}
      </span>
      <span style={{ display: 'flex', fontSize: 30, lineHeight: 1.35, color: '#202124' }}>
        {text}
      </span>
    </div>
  );
}

function shareBody(share: DecodedShare) {
  const [srcLabel, dstLabel] =
    share.direction === 'en2cl' ? ['English', 'Claudish'] : ['Claudish', 'English'];
  return (
    <div style={{ display: 'flex', gap: 24, flex: 1 }}>
      {panel(srcLabel, excerpt(share.source), '#ffffff')}
      {panel(dstLabel, excerpt(share.target), '#f8f9fa')}
    </div>
  );
}

const GENERIC_BODY = (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      justifyContent: 'center',
      gap: 16,
    }}
  >
    <span style={{ display: 'flex', fontSize: 72, color: '#202124' }}>Claudish</span>
    <span style={{ display: 'flex', fontSize: 34, color: '#5f6368' }}>
      English ↔ Claudish, translated while you type
    </span>
  </div>
);

export async function GET(request: Request): Promise<Response> {
  const { share, fonts } = await prepare(request);
  const element = frame(share ? shareBody(share) : GENERIC_BODY, fonts);
  const options = {
    ...SIZE,
    headers: CACHE_HEADERS,
    ...(fonts
      ? {
          fonts: [
            { name: 'Roboto', data: fonts, style: 'normal' as const, weight: 400 as const },
          ],
        }
      : {}),
  };
  try {
    return new ImageResponse(element, options);
  } catch {
    // Satori/ImageResponse itself failed: serve the prebuilt minimal card.
    return new ImageResponse(LAST_RESORT_ELEMENT, { ...SIZE, headers: CACHE_HEADERS });
  }
}
