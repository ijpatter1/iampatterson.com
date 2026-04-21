import jwt from 'jsonwebtoken';

export const METABASE_BASE_URL = 'https://bi.iampatterson.com';
export const DEFAULT_EMBED_TTL_SECONDS = 600; // 10 minutes

export interface EmbedConfig {
  dashboardId: number;
  cardIds: {
    funnel: number;
    aov: number;
    dailyRevenue: number;
  };
}

export function parseEmbedConfig(raw: string | undefined): EmbedConfig {
  if (!raw) {
    throw new Error('METABASE_EMBED_CONFIG env var is missing');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`METABASE_EMBED_CONFIG is not valid JSON: ${(err as Error).message}`);
  }
  if (!isEmbedConfig(parsed)) {
    throw new Error(
      'METABASE_EMBED_CONFIG shape invalid — expected { dashboardId, cardIds: { funnel, aov, dailyRevenue } }',
    );
  }
  return parsed;
}

/**
 * Sign a Metabase static-embed URL for an entire dashboard — Phase 9F D9.
 *
 * payload: { resource: { dashboard: dashboardId }, params: {}, exp }
 * URL:     `${METABASE_BASE_URL}/embed/dashboard/${jwt}#bordered=true&titled=false`
 *
 * `titled=false` because the confirmation page supplies its own lead
 * paragraph + editorial framing; the Metabase-generated dashboard title
 * would compete with the narrative. Same 10-minute HS256 TTL as the
 * question-level signer. Preserves Phase 9B's signing conventions while
 * switching the resource type from `question` to `dashboard`.
 */
export interface DashboardEmbedUrlParams {
  dashboardId: number;
  secret: string;
  ttlSeconds?: number;
}

export function signDashboardEmbedUrl({
  dashboardId,
  secret,
  ttlSeconds = DEFAULT_EMBED_TTL_SECONDS,
}: DashboardEmbedUrlParams): string {
  if (!secret) {
    throw new Error('signDashboardEmbedUrl: secret is required');
  }
  const payload = {
    resource: { dashboard: dashboardId },
    params: {},
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const token = jwt.sign(payload, secret, { algorithm: 'HS256' });
  return `${METABASE_BASE_URL}/embed/dashboard/${token}#bordered=true&titled=false`;
}

/**
 * Glue helper for the Phase 9F confirmation page Server Component: read
 * raw env inputs, mint the single full-dashboard URL, or return null if
 * inputs are missing / malformed. Replaces `mintConfirmationEmbedUrls`
 * (three question-level URLs) — the 9F embed-shape decision is one
 * full-dashboard embed per `docs/REQUIREMENTS.md` D9.
 */
export function mintConfirmationDashboardUrl(env: {
  secret?: string;
  configRaw?: string;
}): string | null {
  const { secret, configRaw } = env;
  if (!secret || !configRaw) return null;
  try {
    const config = parseEmbedConfig(configRaw);
    return signDashboardEmbedUrl({ dashboardId: config.dashboardId, secret });
  } catch (err) {
    console.warn('[metabase/embed] skipping confirmation dashboard embed:', (err as Error).message);
    return null;
  }
}

function isEmbedConfig(x: unknown): x is EmbedConfig {
  if (typeof x !== 'object' || x === null) return false;
  const obj = x as Record<string, unknown>;
  if (typeof obj.dashboardId !== 'number') return false;
  const cardIds = obj.cardIds;
  if (typeof cardIds !== 'object' || cardIds === null) return false;
  const cids = cardIds as Record<string, unknown>;
  return (
    typeof cids.funnel === 'number' &&
    typeof cids.aov === 'number' &&
    typeof cids.dailyRevenue === 'number'
  );
}
