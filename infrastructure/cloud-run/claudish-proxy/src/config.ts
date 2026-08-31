/**
 * claudish-proxy — configuration.
 *
 * Everything operational is env-driven so lane order, budgets, and the
 * kill switch are config flips, not deploys of new code. Model IDs and
 * prices are pinned constants awaiting the pre-deploy verification pass
 * (research memo 2026-08-31); setup.sh refuses a real deploy until
 * MODEL_ID_CONFIRMED=1.
 */

export const LANE_NAMES = [
  'vertex-global',
  'vertex-regional',
  'anthropic-api',
  'cache-only',
] as const;
export type LaneName = (typeof LANE_NAMES)[number];

export type Direction = 'en2cl' | 'cl2en';

/**
 * USD per million tokens. Global-endpoint Vertex rates for Claude Haiku
 * 4.5 (verified against mirrors 2026-08-31; regional carries +10%).
 * VERIFY on the live pricing page before first deploy.
 */
export const PRICES = {
  inputPerMTok: 1.0,
  outputPerMTok: 5.0,
  cacheWritePerMTok: 1.25,
  cacheReadPerMTok: 0.1,
} as const;

/** Worst-case per-request reservation: max input + max output, cache-miss. */
export const RESERVATION_USD = 0.006;

/** Server-side input cap (chars); the client shows and enforces the same number. */
export const INPUT_CAP = 1200;

export const MAX_TOKENS: Record<Direction, number> = {
  en2cl: 1024, // Claudish expands
  cl2en: 512, // English compresses
};

/** First-token deadline before the ladder advances to the next lane. */
export const FIRST_TOKEN_DEADLINE_MS = 3000;

export interface Config {
  port: number;
  allowedOrigins: string[];
  lanes: LaneName[];
  projectId: string;
  vertexModelId: string;
  anthropicModelId: string;
  vertexFallbackRegion: string;
  dailyBudgetUsd: number;
  maxInstances: number;
  killSwitch: boolean;
  requireOrigin: boolean;
  trustedProxyHops: number;
  modelIdConfirmed: boolean;
}

// TODO(model-id): confirm against Vertex Model Garden before first deploy.
// Vertex keeps the @date suffix for Haiku 4.5; the first-party API takes
// the bare alias. Retirement floor 2026-10-15 — expect a bump soon.
const DEFAULT_VERTEX_MODEL_ID = 'claude-haiku-4-5@20251001';
const DEFAULT_ANTHROPIC_MODEL_ID = 'claude-haiku-4-5';

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const lanesRaw = env.LANES ?? 'vertex-global,vertex-regional,anthropic-api,cache-only';
  const lanes = lanesRaw.split(',').map((lane) => lane.trim()) as LaneName[];
  for (const lane of lanes) {
    if (!LANE_NAMES.includes(lane)) {
      throw new Error(
        `LANES contains unknown lane "${lane}" — valid: ${LANE_NAMES.join(', ')}`
      );
    }
  }
  const dailyBudgetUsd = Number(env.DAILY_BUDGET_USD ?? 23);
  if (!Number.isFinite(dailyBudgetUsd) || dailyBudgetUsd <= 0) {
    throw new Error(`DAILY_BUDGET_USD must be a positive number, got "${env.DAILY_BUDGET_USD}"`);
  }
  return {
    port: Number(env.PORT ?? 8080),
    allowedOrigins: (
      env.ALLOWED_ORIGINS ?? 'https://iampatterson-com.vercel.app,https://iampatterson.com'
    )
      .split(',')
      .map((o) => o.trim()),
    lanes,
    projectId: env.GCP_PROJECT ?? 'iampatterson',
    vertexModelId: env.VERTEX_MODEL_ID ?? DEFAULT_VERTEX_MODEL_ID,
    anthropicModelId: env.ANTHROPIC_MODEL_ID ?? DEFAULT_ANTHROPIC_MODEL_ID,
    vertexFallbackRegion: env.VERTEX_FALLBACK_REGION ?? 'us-east5',
    dailyBudgetUsd,
    maxInstances: Number(env.MAX_INSTANCES ?? 4),
    killSwitch: env.KILL_SWITCH === 'on',
    requireOrigin: env.REQUIRE_ORIGIN !== 'false',
    trustedProxyHops: Number(env.TRUSTED_PROXY_HOPS ?? 2),
    modelIdConfirmed: env.MODEL_ID_CONFIRMED === '1',
  };
}
