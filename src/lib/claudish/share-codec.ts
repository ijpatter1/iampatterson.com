/**
 * Claudish translator — share-URL codec.
 *
 * A share link reproduces the translation with no server storage: the
 * payload {v, d, s, t, x} travels in ?t= as lz-string
 * compressToEncodedURIComponent. lz-string over base64-of-UTF-8 is
 * deliberate: it operates on UTF-16 code units, so an em dash costs one
 * unit rather than three bytes — on a page about em dashes. It can also
 * EXPAND incompressible input, which is why the budget loop below is
 * load-bearing, not defensive.
 *
 * Decoding tolerates real-world query-string mangling: URLSearchParams
 * maps '+' (a legal lz-string alphabet character) to a space, and the
 * decoder maps it back before decompressing.
 */
import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from 'lz-string';

import { INPUT_CAP, SHARE_URL_MAX } from './limits';

/** Decompressed-target ceiling: generously above any real translation. */
export const MAX_TARGET_CHARS = 12_000; // a 3,000-char input fully expanded (3.5x) still encodes
/** Param ceiling: refuse hostile input before it reaches the decompressor. */
const MAX_PARAM_CHARS = 4096;

export type ShareDirection = 'en2cl' | 'cl2en';

export interface SharePayload {
  direction: ShareDirection;
  source: string;
  target: string;
}

export interface DecodedShare extends SharePayload {
  /** True when the shared text is a truncated excerpt of the original. */
  excerpt: boolean;
}

export interface EncodedShare {
  url: string;
  /** True when any tier below "full payload" was needed. */
  truncated: boolean;
  urlChars: number;
}

interface WirePayload {
  v: 1;
  d: ShareDirection;
  s: string;
  t: string;
  x?: 1;
}

/** Cut at a word boundary at or below maxChars (hard cut when no space exists). */
function truncateAtWord(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(' ');
  return (lastSpace > maxChars * 0.5 ? slice.slice(0, lastSpace) : slice).trimEnd();
}

export function encodeShare(
  payload: SharePayload,
  options: { baseUrl?: string; maxChars?: number } = {}
): EncodedShare {
  const baseUrl = options.baseUrl ?? '/claudish';
  const maxChars = options.maxChars ?? SHARE_URL_MAX;

  const attempt = (s: string, t: string, excerpt: boolean): string | null => {
    const wire: WirePayload = excerpt
      ? { v: 1, d: payload.direction, s, t, x: 1 }
      : { v: 1, d: payload.direction, s, t };
    const url = `${baseUrl}?t=${compressToEncodedURIComponent(JSON.stringify(wire))}`;
    return url.length <= maxChars ? url : null;
  };

  // Tier 0: the full payload.
  const full = attempt(payload.source, payload.target, false);
  if (full) return { url: full, truncated: false, urlChars: full.length };

  // Tiers 1-3: shrink the target toward an excerpt.
  for (const targetCap of [800, 400, 200]) {
    const url = attempt(payload.source, truncateAtWord(payload.target, targetCap), true);
    if (url) return { url, truncated: true, urlChars: url.length };
  }
  // Tiers 4-5: shrink the source as well.
  for (const sourceCap of [600, 300]) {
    const url = attempt(
      truncateAtWord(payload.source, sourceCap),
      truncateAtWord(payload.target, 200),
      true
    );
    if (url) return { url, truncated: true, urlChars: url.length };
  }
  // Tier 6: source only.
  const sourceOnly = attempt(truncateAtWord(payload.source, 300), '', true);
  if (sourceOnly) {
    return { url: sourceOnly, truncated: true, urlChars: sourceOnly.length };
  }
  // Tier 7: bare link — the share still lands on the tool.
  return { url: baseUrl, truncated: true, urlChars: baseUrl.length };
}

export function decodeShare(t: string): DecodedShare | null {
  if (typeof t !== 'string' || t.length === 0 || t.length > MAX_PARAM_CHARS) return null;
  try {
    // URLSearchParams turns '+' into a space; lz-string's URI alphabet
    // never emits a space, so mapping back is lossless.
    const json = decompressFromEncodedURIComponent(t.replace(/ /g, '+'));
    if (!json) return null;
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const wire = parsed as Partial<WirePayload>;
    if (wire.v !== 1) return null;
    if (wire.d !== 'en2cl' && wire.d !== 'cl2en') return null;
    if (typeof wire.s !== 'string' || typeof wire.t !== 'string') return null;
    // A crafted payload must not bypass the input cap (the textarea's
    // maxLength doesn't truncate programmatic values) or seed absurd output.
    if (wire.s.length > INPUT_CAP || wire.t.length > MAX_TARGET_CHARS) return null;
    return {
      direction: wire.d,
      source: wire.s,
      target: wire.t,
      excerpt: wire.x === 1,
    };
  } catch {
    return null;
  }
}
