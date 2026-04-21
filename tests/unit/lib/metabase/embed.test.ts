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
  mintConfirmationDashboardUrl,
  mintConfirmationEmbedUrls,
  parseEmbedConfig,
  signDashboardEmbedUrl,
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

  it('throws on empty secret via the explicit guard before jwt.sign is called', () => {
    expect(() => signEmbedUrl({ cardId: 40, secret: '' })).toThrow(/secret is required/);
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
  // Works for both `/embed/question/:jwt` (9B) and `/embed/dashboard/:jwt` (9F).
  const questionPrefix = `${METABASE_BASE_URL}/embed/question/`;
  const dashboardPrefix = `${METABASE_BASE_URL}/embed/dashboard/`;
  const prefix = url.startsWith(dashboardPrefix) ? dashboardPrefix : questionPrefix;
  const hashIdx = url.indexOf('#');
  return url.slice(prefix.length, hashIdx);
}

describe('mintConfirmationEmbedUrls', () => {
  const VALID_CONFIG = '{"dashboardId":2,"cardIds":{"funnel":40,"aov":41,"dailyRevenue":45}}';

  let warnSpy: jest.SpyInstance;
  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('returns null when secret is missing', () => {
    expect(mintConfirmationEmbedUrls({ configRaw: VALID_CONFIG })).toBeNull();
  });

  it('returns null when configRaw is missing', () => {
    expect(mintConfirmationEmbedUrls({ secret: TEST_SECRET })).toBeNull();
  });

  it('returns null and warns when configRaw is malformed (does not throw)', () => {
    const result = mintConfirmationEmbedUrls({ secret: TEST_SECRET, configRaw: '{not json' });
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('returns three signed URLs when both env inputs are present', () => {
    const result = mintConfirmationEmbedUrls({ secret: TEST_SECRET, configRaw: VALID_CONFIG });
    expect(result).not.toBeNull();
    expect(result!.dailyRevenue.startsWith(METABASE_BASE_URL)).toBe(true);
    expect(result!.funnel.startsWith(METABASE_BASE_URL)).toBe(true);
    expect(result!.aov.startsWith(METABASE_BASE_URL)).toBe(true);
  });

  it('each URL carries a JWT whose resource.question matches the config card id', () => {
    const result = mintConfirmationEmbedUrls({ secret: TEST_SECRET, configRaw: VALID_CONFIG })!;
    expect(
      (jwt.verify(extractToken(result.dailyRevenue), TEST_SECRET) as jwt.JwtPayload).resource,
    ).toEqual({ question: 45 });
    expect(
      (jwt.verify(extractToken(result.funnel), TEST_SECRET) as jwt.JwtPayload).resource,
    ).toEqual({ question: 40 });
    expect((jwt.verify(extractToken(result.aov), TEST_SECRET) as jwt.JwtPayload).resource).toEqual({
      question: 41,
    });
  });
});

// Phase 9F D9 — full-dashboard embed path (replaces the three question-level
// embeds from 9B with a single dashboard-level JWT per the doc spec's
// "one full-dashboard embed, not six individual" decision).
describe('signDashboardEmbedUrl (Phase 9F D9)', () => {
  it('returns a URL under the Metabase base host with /embed/dashboard/ path', () => {
    const url = signDashboardEmbedUrl({ dashboardId: 2, secret: TEST_SECRET });
    expect(url.startsWith(`${METABASE_BASE_URL}/embed/dashboard/`)).toBe(true);
  });

  it('appends the #bordered=true&titled=false fragment', () => {
    const url = signDashboardEmbedUrl({ dashboardId: 2, secret: TEST_SECRET });
    expect(url.endsWith('#bordered=true&titled=false')).toBe(true);
  });

  it('JWT encodes resource.dashboard, not resource.question', () => {
    const url = signDashboardEmbedUrl({ dashboardId: 2, secret: TEST_SECRET });
    const token = extractToken(url);
    const decoded = jwt.verify(token, TEST_SECRET) as jwt.JwtPayload;
    expect(decoded.resource).toEqual({ dashboard: 2 });
  });

  it('JWT verifies with the same secret, fails with a different secret', () => {
    const url = signDashboardEmbedUrl({ dashboardId: 2, secret: TEST_SECRET });
    const token = extractToken(url);
    expect(() => jwt.verify(token, TEST_SECRET)).not.toThrow();
    expect(() => jwt.verify(token, 'wrong-secret')).toThrow();
  });

  it('defaults to the 10-minute TTL used by the question-level signer', () => {
    const now = Math.floor(Date.now() / 1000);
    const url = signDashboardEmbedUrl({ dashboardId: 2, secret: TEST_SECRET });
    const token = extractToken(url);
    const decoded = jwt.verify(token, TEST_SECRET) as jwt.JwtPayload;
    expect(decoded.exp).toBeGreaterThanOrEqual(now + DEFAULT_EMBED_TTL_SECONDS - 5);
    expect(decoded.exp).toBeLessThanOrEqual(now + DEFAULT_EMBED_TTL_SECONDS + 5);
  });

  it('throws when secret is missing or empty', () => {
    expect(() => signDashboardEmbedUrl({ dashboardId: 2, secret: '' })).toThrow(
      /secret is required/,
    );
  });
});

describe('mintConfirmationDashboardUrl', () => {
  const VALID_CONFIG = '{"dashboardId":2,"cardIds":{"funnel":40,"aov":41,"dailyRevenue":45}}';

  it('returns null when secret is missing', () => {
    const url = mintConfirmationDashboardUrl({ configRaw: VALID_CONFIG });
    expect(url).toBeNull();
  });

  it('returns null when configRaw is missing', () => {
    const url = mintConfirmationDashboardUrl({ secret: TEST_SECRET });
    expect(url).toBeNull();
  });

  it('returns null when config JSON is malformed', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const url = mintConfirmationDashboardUrl({ secret: TEST_SECRET, configRaw: 'not-json' });
    expect(url).toBeNull();
    warn.mockRestore();
  });

  it('returns a signed URL using the config dashboardId when both inputs valid', () => {
    const url = mintConfirmationDashboardUrl({ secret: TEST_SECRET, configRaw: VALID_CONFIG })!;
    expect(url).not.toBeNull();
    const token = extractToken(url);
    const decoded = jwt.verify(token, TEST_SECRET) as jwt.JwtPayload;
    // VALID_CONFIG fixture sets dashboardId = 2
    expect(decoded.resource).toEqual({ dashboard: 2 });
  });
});
