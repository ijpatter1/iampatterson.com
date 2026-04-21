/**
 * Phase 9B deliverable 6b, Metabase static-embed signer.
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
  parseEmbedConfig,
  readConfirmationDashboardId,
  signDashboardEmbedUrl,
} from '@/lib/metabase/embed';

const TEST_SECRET = 'test-secret-0123456789abcdef0123456789abcdef';

// Phase 9F D10 note: the pre-9F question-level signEmbedUrl +
// mintConfirmationEmbedUrls helpers (and their 9 + 6 tests) were removed as
// part of the cleanup, D9's full-dashboard embed path superseded them and
// no callers remained. The dashboard-level signDashboardEmbedUrl tests near
// the bottom of this file cover the preserved signing invariants (URL
// shape, JWT payload, HS256, TTL behaviour, empty-secret guard).

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

// Phase 9F D9, full-dashboard embed path (replaces the three question-level
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

describe('readConfirmationDashboardId', () => {
  const VALID_CONFIG = '{"dashboardId":7,"cardIds":{"funnel":40,"aov":41,"dailyRevenue":45}}';

  it('returns the dashboardId when config is valid', () => {
    expect(readConfirmationDashboardId(VALID_CONFIG)).toBe(7);
  });

  it('returns null when configRaw is undefined', () => {
    expect(readConfirmationDashboardId(undefined)).toBeNull();
  });

  it('returns null when configRaw is malformed (no throw)', () => {
    expect(readConfirmationDashboardId('not-json')).toBeNull();
  });

  it('returns null when config is structurally invalid', () => {
    expect(readConfirmationDashboardId('{"something":"else"}')).toBeNull();
  });
});
