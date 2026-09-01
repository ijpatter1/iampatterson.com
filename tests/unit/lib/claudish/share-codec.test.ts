/**
 * Claudish translator — share-URL codec (feat/claudish M2).
 *
 * Share URLs reproduce a translation with no server storage: the payload
 * {v, d, s, t} rides in ?t= as lz-string compressToEncodedURIComponent.
 * Contract under test:
 *  - round trip through a REAL URL/URLSearchParams (the lz-string
 *    alphabet includes '+', which query decoding turns into a space —
 *    the decoder must survive that);
 *  - budget: realistic cap-length input stays under SHARE_URL_MAX;
 *    incompressible (adversarial) input degrades through truncation tiers
 *    to a bare link instead of emitting an over-budget URL;
 *  - version discipline: unknown versions and garbage decode to null.
 */
import {
  decodeShare,
  encodeShare,
} from '@/lib/claudish/share-codec';
import { SHARE_URL_MAX } from '@/lib/claudish/limits';

const BASE = 'https://iampatterson.com/claudish';

const roundTripThroughUrl = (url: string) => {
  const t = new URL(url).searchParams.get('t');
  expect(t).not.toBeNull();
  return decodeShare(t as string);
};

describe('encodeShare / decodeShare', () => {
  it('round-trips a typical translation through a real URL', () => {
    const payload = {
      direction: 'en2cl' as const,
      source: 'We should ship the fix on Friday.',
      target:
        "This isn't just a fix — it's a commitment. Shipping on Friday means the weekend holds.",
    };
    const { url, truncated } = encodeShare(payload, { baseUrl: BASE });
    expect(truncated).toBe(false);
    const decoded = roundTripThroughUrl(url);
    expect(decoded).toEqual({ ...payload, excerpt: false });
  });

  it('survives the lz-string +/space footgun through URLSearchParams', () => {
    // The compressToEncodedURIComponent alphabet includes '+'. Find an
    // input whose encoding contains one, then round-trip it through real
    // query-string decoding (which maps '+' to space).
    let found = false;
    for (let i = 0; i < 500 && !found; i++) {
      const payload = {
        direction: 'cl2en' as const,
        source: `probe ${i} ${'x'.repeat(i % 40)}`,
        target: `result ${i * 7}`,
      };
      const { url } = encodeShare(payload, { baseUrl: BASE });
      const raw = url.split('?t=')[1];
      if (raw.includes('+')) {
        found = true;
        expect(roundTripThroughUrl(url)).toEqual({ ...payload, excerpt: false });
      }
    }
    expect(found).toBe(true);
  });

  it('keeps realistic cap-length prose under the URL budget without truncation', () => {
    const sentence =
      'The measurement stack routes every event through consent checks before anything ships downstream. ';
    const payload = {
      direction: 'en2cl' as const,
      source: sentence.repeat(12).slice(0, 1200),
      target: (sentence + '— not as an afterthought; as the architecture. ')
        .repeat(18)
        .slice(0, 2400),
    };
    const { url, truncated, urlChars } = encodeShare(payload, { baseUrl: BASE });
    expect(truncated).toBe(false);
    expect(urlChars).toBe(url.length);
    expect(url.length).toBeLessThanOrEqual(SHARE_URL_MAX);
  });

  it('degrades adversarial incompressible input through tiers, never over budget', () => {
    // Pseudo-random base64-ish text compresses badly (can even expand).
    let seed = 42;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const alphabet =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const junk = (n: number) =>
      Array.from({ length: n }, () => alphabet[Math.floor(rand() * 62)]).join('');
    const { url, truncated } = encodeShare(
      { direction: 'en2cl', source: junk(1200), target: junk(2400) },
      { baseUrl: BASE }
    );
    expect(url.length).toBeLessThanOrEqual(SHARE_URL_MAX);
    expect(truncated).toBe(true);
  });

  it('marks word-boundary excerpts and preserves the source when only the target is cut', () => {
    const source = 'short question';
    const target = ('word '.repeat(70) + 'ZQZQZQ' + junkBlock()).slice(0, 2400);
    function junkBlock(): string {
      let s = 7;
      const r = () => ((s = (s * 48271) % 2147483647) / 2147483647);
      return Array.from({ length: 2200 }, () =>
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'[Math.floor(r() * 52)]
      ).join('');
    }
    const { url, truncated } = encodeShare(
      { direction: 'en2cl', source, target },
      { baseUrl: BASE }
    );
    expect(truncated).toBe(true);
    const decoded = roundTripThroughUrl(url);
    expect(decoded).not.toBeNull();
    if (decoded && decoded.target.length > 0) {
      expect(decoded.excerpt).toBe(true);
      expect(decoded.source).toBe(source);
      expect(decoded.target.length).toBeLessThan(target.length);
      expect(decoded.target.endsWith(' ')).toBe(false); // word-boundary cut
    }
  });

  it('decodes garbage and unknown versions to null, never throwing', () => {
    expect(decodeShare('not-compressed-data')).toBeNull();
    expect(decodeShare('')).toBeNull();
    // A well-formed payload with a future version must be rejected.
    const lz = jest.requireActual('lz-string') as typeof import('lz-string');
    const v2 = lz.compressToEncodedURIComponent(
      JSON.stringify({ v: 2, d: 'en2cl', s: 'a', t: 'b' })
    );
    expect(decodeShare(v2)).toBeNull();
  });

  it('rejects oversized inputs before and after decompression (hostile-share gate)', () => {
    const lz = jest.requireActual('lz-string') as typeof import('lz-string');
    // Param longer than any legitimate share URL: refused before decompression.
    expect(decodeShare('A'.repeat(5000))).toBeNull();
    // Decompressed source past the input cap: refused (would bypass maxLength).
    const overCap = lz.compressToEncodedURIComponent(
      JSON.stringify({ v: 1, d: 'en2cl', s: 'x'.repeat(1300), t: 'y' })
    );
    expect(decodeShare(overCap)).toBeNull();
    // Absurd target size: refused.
    const hugeTarget = lz.compressToEncodedURIComponent(
      JSON.stringify({ v: 1, d: 'en2cl', s: 'ok', t: 'y'.repeat(9000) })
    );
    expect(decodeShare(hugeTarget)).toBeNull();
  });

  it('rejects payloads with a bad direction or non-string panels', () => {
    const lz = jest.requireActual('lz-string') as typeof import('lz-string');
    const bad = (obj: unknown) =>
      decodeShare(lz.compressToEncodedURIComponent(JSON.stringify(obj)));
    expect(bad({ v: 1, d: 'fr2en', s: 'a', t: 'b' })).toBeNull();
    expect(bad({ v: 1, d: 'en2cl', s: 5, t: 'b' })).toBeNull();
  });
});
