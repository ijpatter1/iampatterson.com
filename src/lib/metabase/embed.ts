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

export interface EmbedUrlParams {
  cardId: number;
  secret: string;
  ttlSeconds?: number;
}

/**
 * Sign a Metabase static-embed URL for a single question (card).
 * payload: { resource: { question: cardId }, params: {}, exp }
 * URL:     `${METABASE_BASE_URL}/embed/question/${jwt}#bordered=true&titled=true`
 * 10-minute default TTL: long enough for a tab-switch, short enough that
 * leaked URLs have a limited shelf life. HS256 per Metabase's spec.
 */
export function signEmbedUrl({
  cardId,
  secret,
  ttlSeconds = DEFAULT_EMBED_TTL_SECONDS,
}: EmbedUrlParams): string {
  if (!secret) {
    throw new Error('signEmbedUrl: secret is required');
  }
  const payload = {
    resource: { question: cardId },
    params: {},
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const token = jwt.sign(payload, secret, { algorithm: 'HS256' });
  return `${METABASE_BASE_URL}/embed/question/${token}#bordered=true&titled=true`;
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
