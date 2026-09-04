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

/**
 * Gemini 3.5 Flash-Lite on Vertex (global endpoint), USD per million tokens —
 * the cl2en loop lane. Implicit cache reads are billed at a discount;
 * there is no explicit write charge on the implicit path.
 */
// Gemini standard global tier (cloud.google.com/vertex-ai/generative-ai/pricing, read
// 2026-09-01): 2.5 Flash and 3.5 Flash-Lite both bill $0.30 in / $2.50 out on-demand;
// cached reads are $0.03 on 3.5 Flash-Lite (were $0.075 on 2.5 Flash).
export const GEMINI_PRICES = {
  inputPerMTok: 0.3,
  outputPerMTok: 2.5,
  cacheWritePerMTok: 0.3,
  cacheReadPerMTok: 0.03,
} as const;

export type PriceTable = { readonly [K in keyof typeof PRICES]: number };

/**
 * Worst-case per-request reservation, en2cl at the cap with a cold
 * prefix (bundle Stage 2: the ~5.0k-token prefix is cacheable, so the
 * cold case is a cache WRITE at 1.25x): ~5.0k x $1.25/MTok + ~0.8k input
 * x $1/MTok + ~2.8k output x $5/MTok ≈ $0.021. Pinned >= the derived
 * figure in limits-contract.test.ts.
 */
export const RESERVATION_USD = 0.022;

/**
 * Server-side input cap (chars); the client shows and enforces the same
 * number. 3,000 = LinkedIn's post limit (Ian, 2026-09-01).
 */
export const INPUT_CAP = 3000;

export const MAX_TOKENS: Record<Direction, number> = {
  en2cl: 3072, // Claudish expands up to 3.5x: a cap-length input needs ~2.8k
  cl2en: 1536, // English compresses, but dense input can run ~1:1
};

/** First-token deadline before the ladder advances to the next lane. */
export const FIRST_TOKEN_DEADLINE_MS = 3000;

/**
 * Production origins, the Vercel preview pattern (every preview deployment
 * of this project starts with iampatterson-com-), and local dev. Added
 * 2026-09-02 when the exact-match list sent localhost and previews to 403.
 */
// www is the host production redirects to (2026-09-04: the launch page showed the
// boundary line because only the apex was allowed).
export const DEFAULT_ALLOWED_ORIGINS =
  'https://iampatterson.com,https://www.iampatterson.com,https://iampatterson-com.vercel.app,https://iampatterson-com-*.vercel.app,http://localhost:3000';

/** Exact match, or a single `*` in the entry's host matched as prefix + suffix (scheme and port literal). */
export function isOriginAllowed(origin: string, allowed: readonly string[]): boolean {
  if (!origin) return false;
  for (const entry of allowed) {
    const star = entry.indexOf('*');
    if (star < 0) {
      if (entry === origin) return true;
      continue;
    }
    if (entry.indexOf('*', star + 1) >= 0) continue; // one wildcard only
    const prefix = entry.slice(0, star);
    const suffix = entry.slice(star + 1);
    if (
      origin.length > prefix.length + suffix.length &&
      origin.startsWith(prefix) &&
      origin.endsWith(suffix) &&
      !origin.slice(prefix.length, origin.length - suffix.length).includes('/')
    ) {
      return true;
    }
  }
  return false;
}

export interface Config {
  port: number;
  /** Exact origins, or entries with ONE `*` in the host (prefix + suffix match). */
  allowedOrigins: string[];
  lanes: LaneName[];
  projectId: string;
  vertexModelId: string;
  anthropicModelId: string;
  vertexFallbackRegion: string;
  cl2enEngine: 'lanes' | 'gemini-loop';
  geminiModelId: string;
  geminiLocation: string;
  dailyBudgetUsd: number;
  maxInstances: number;
  killSwitch: boolean;
  requireOrigin: boolean;
  trustedProxyHops: number;
  modelIdConfirmed: boolean;
  /** Test-only: when set and the input text equals it, the orchestrator
   * synthesizes a refusal stream — lets a DEPLOYED service's refusal path
   * be smoke-tested through real network/framing without a live trigger
   * (the documented magic string was patched out ~May 2026). NEVER set
   * in production. */
  forceRefusalToken: string | null;
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
  // A NaN/0 here would divide the budget into nonsense and fail the spend
  // cap OPEN — the one direction this service must never fail.
  const maxInstances = Number(env.MAX_INSTANCES ?? 4);
  if (!Number.isInteger(maxInstances) || maxInstances < 1) {
    throw new Error(`MAX_INSTANCES must be a positive integer, got "${env.MAX_INSTANCES}"`);
  }
  // Default 1: direct run.app, last X-Forwarded-For entry is the client.
  // 2 only behind an external load balancer. Invalid values used to fall
  // back silently to the front-end hop and collapse every visitor onto one
  // rate-limit key (review batch 1).
  const trustedProxyHops = Number(env.TRUSTED_PROXY_HOPS ?? 1);
  if (!Number.isInteger(trustedProxyHops) || trustedProxyHops < 1) {
    throw new Error(`TRUSTED_PROXY_HOPS must be a positive integer, got "${env.TRUSTED_PROXY_HOPS}"`);
  }
  return {
    port: Number(env.PORT ?? 8080),
    allowedOrigins: (env.ALLOWED_ORIGINS ?? DEFAULT_ALLOWED_ORIGINS)
      .split(',')
      .map((o) => o.trim()),
    lanes,
    projectId: env.GCP_PROJECT ?? 'iampatterson',
    vertexModelId: env.VERTEX_MODEL_ID ?? DEFAULT_VERTEX_MODEL_ID,
    anthropicModelId: env.ANTHROPIC_MODEL_ID ?? DEFAULT_ANTHROPIC_MODEL_ID,
    vertexFallbackRegion: env.VERTEX_FALLBACK_REGION ?? 'us-east5',
    // cl2en engine: 'lanes' = the Claude ladder (safe default);
    // 'gemini-loop' = the judge-driven refinement loop (Ian 2026-09-01).
    // en2cl always rides the Claude ladder — no one speaks Claude like
    // Claude.
    cl2enEngine: env.CL2EN_ENGINE === 'gemini-loop' ? ('gemini-loop' as const) : ('lanes' as const),
    // Gemini 3.x serves only through the global endpoint on Vertex (the
    // regional path 404s); 2.5 models accept either. Switched from
    // gemini-2.5-flash (sunset inside two months) on Ian's call,
    // 2026-09-01; the two must move together.
    geminiModelId: env.GEMINI_MODEL_ID ?? 'gemini-3.5-flash-lite',
    geminiLocation: env.GEMINI_LOCATION ?? 'global',
    dailyBudgetUsd,
    maxInstances,
    killSwitch: env.KILL_SWITCH === 'on',
    requireOrigin: env.REQUIRE_ORIGIN !== 'false',
    trustedProxyHops,
    modelIdConfirmed: env.MODEL_ID_CONFIRMED === '1',
    forceRefusalToken: env.FORCE_REFUSAL_TOKEN || null,
  };
}
