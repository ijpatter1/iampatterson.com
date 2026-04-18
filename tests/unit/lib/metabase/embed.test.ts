/**
 * Phase 9B deliverable 6b — Metabase static-embed signer.
 *
 * The signer is the boundary between Next.js and Metabase's embed feature.
 * Everything downstream (iframe rendering, fallback handling) depends on
 * it producing correct JWTs, so invariants are tested exhaustively here.
 */
import jwt from 'jsonwebtoken';

import {
  DEFAULT_EMBED_TTL_SECONDS,
  METABASE_BASE_URL,
  parseEmbedConfig,
  signEmbedUrl,
} from '@/lib/metabase/embed';

const TEST_SECRET = 'test-secret-0123456789abcdef0123456789abcdef';

describe('signEmbedUrl', () => {
  it('returns a URL under the Metabase base host with the /embed/question/ path', () => {
    const url = signEmbedUrl({ cardId: 40, secret: TEST_SECRET });
    expect(url.startsWith(`${METABASE_BASE_URL}/embed/question/`)).toBe(true);
  });

  it('appends the #bordered=true&titled=true fragment Metabase expects', () => {
    const url = signEmbedUrl({ cardId: 40, secret: TEST_SECRET });
    expect(url.endsWith('#bordered=true&titled=true')).toBe(true);
  });

  it('produces a JWT that verifies with the same secret', () => {
    const url = signEmbedUrl({ cardId: 41, secret: TEST_SECRET });
    const token = extractToken(url);
    expect(() => jwt.verify(token, TEST_SECRET)).not.toThrow();
  });

  it('produces a JWT that does NOT verify with a different secret', () => {
    const url = signEmbedUrl({ cardId: 41, secret: TEST_SECRET });
    const token = extractToken(url);
    expect(() => jwt.verify(token, 'wrong-secret')).toThrow();
  });

  it('encodes the card ID as resource.question in the payload', () => {
    const url = signEmbedUrl({ cardId: 45, secret: TEST_SECRET });
    const token = extractToken(url);
    const decoded = jwt.verify(token, TEST_SECRET) as jwt.JwtPayload;
    expect(decoded.resource).toEqual({ question: 45 });
  });

  it('includes an empty params object (required by Metabase for parameter-less cards)', () => {
    const url = signEmbedUrl({ cardId: 40, secret: TEST_SECRET });
    const token = extractToken(url);
    const decoded = jwt.verify(token, TEST_SECRET) as jwt.JwtPayload;
    expect(decoded.params).toEqual({});
  });

  it('sets exp to now + default TTL (10 minutes) by default', () => {
    const now = Math.floor(Date.now() / 1000);
    const url = signEmbedUrl({ cardId: 40, secret: TEST_SECRET });
    const token = extractToken(url);
    const decoded = jwt.verify(token, TEST_SECRET) as jwt.JwtPayload;
    const expected = now + DEFAULT_EMBED_TTL_SECONDS;
    // Allow ±5s slack for wall-clock drift between test and sign
    expect(decoded.exp).toBeGreaterThanOrEqual(expected - 5);
    expect(decoded.exp).toBeLessThanOrEqual(expected + 5);
  });

  it('honors a custom TTL when provided', () => {
    const now = Math.floor(Date.now() / 1000);
    const customTtl = 1800; // 30 min
    const url = signEmbedUrl({ cardId: 40, secret: TEST_SECRET, ttlSeconds: customTtl });
    const token = extractToken(url);
    const decoded = jwt.verify(token, TEST_SECRET) as jwt.JwtPayload;
    expect(decoded.exp).toBeGreaterThanOrEqual(now + customTtl - 5);
    expect(decoded.exp).toBeLessThanOrEqual(now + customTtl + 5);
  });

  it('uses HS256 algorithm (Metabase static-embed requirement)', () => {
    const url = signEmbedUrl({ cardId: 40, secret: TEST_SECRET });
    const token = extractToken(url);
    // decode with complete=true to access the header
    const decoded = jwt.decode(token, { complete: true });
    expect(decoded?.header.alg).toBe('HS256');
  });

  it('throws when secret is empty (jsonwebtoken rejects blank keys)', () => {
    expect(() => signEmbedUrl({ cardId: 40, secret: '' })).toThrow();
  });
});

describe('parseEmbedConfig', () => {
  it('parses valid JSON with the expected shape', () => {
    const raw = '{"dashboardId":2,"cardIds":{"funnel":40,"aov":41,"dailyRevenue":45}}';
    const parsed = parseEmbedConfig(raw);
    expect(parsed).toEqual({
      dashboardId: 2,
      cardIds: { funnel: 40, aov: 41, dailyRevenue: 45 },
    });
  });

  it('throws when raw is undefined (env var missing)', () => {
    expect(() => parseEmbedConfig(undefined)).toThrow(/missing/i);
  });

  it('throws when raw is empty string', () => {
    expect(() => parseEmbedConfig('')).toThrow(/missing/i);
  });

  it('throws with a useful message on malformed JSON', () => {
    expect(() => parseEmbedConfig('{not json')).toThrow(/not valid JSON/i);
  });

  it('throws when dashboardId is missing', () => {
    expect(() => parseEmbedConfig('{"cardIds":{"funnel":40,"aov":41,"dailyRevenue":45}}')).toThrow(
      /shape invalid/i,
    );
  });

  it('throws when a cardIds key is missing', () => {
    expect(() => parseEmbedConfig('{"dashboardId":2,"cardIds":{"funnel":40,"aov":41}}')).toThrow(
      /shape invalid/i,
    );
  });

  it('throws when cardIds value is the wrong type', () => {
    expect(() =>
      parseEmbedConfig('{"dashboardId":2,"cardIds":{"funnel":"40","aov":41,"dailyRevenue":45}}'),
    ).toThrow(/shape invalid/i);
  });
});

function extractToken(url: string): string {
  const prefix = `${METABASE_BASE_URL}/embed/question/`;
  const hashIdx = url.indexOf('#');
  return url.slice(prefix.length, hashIdx);
}
