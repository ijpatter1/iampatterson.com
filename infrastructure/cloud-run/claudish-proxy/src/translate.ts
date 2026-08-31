/**
 * claudish-proxy — the translate orchestrator.
 *
 * Two-channel contract: before any upstream stream opens, failures are
 * HTTP status codes; after the SSE stream opens, everything is a frame
 * and the response is always 200. The commit barrier: once the first
 * token frame is written, the ladder never advances (re-running a lane
 * would duplicate text) — a post-commit 429 becomes `capacity`,
 * anything else `error`. Refusals are terminal by design: retrying a
 * refusal on another lane is a policy decision this toy does not make.
 *
 * Cancellation: req 'close' aborts the upstream call (an abandoned
 * stream is pure token burn), abandons the SSE writer, and reconciles
 * the budget reservation with a chars/4 estimate of partial usage.
 */
import { randomUUID } from 'node:crypto';

import { cacheKey, normalizeInput } from './cache';
import { FIRST_TOKEN_DEADLINE_MS, INPUT_CAP } from './config';
import { hashIp, logEvent, redactError } from './log';
import { clientIp } from './ratelimit';
import { SseStream } from './sse';
import { PROMPT_VERSION } from './prompts';

import type { Request, Response } from 'express';
import type { BudgetTracker, Reservation, Usage } from './budget';
import type { Config, Direction } from './config';
import type { CircuitBreaker, LaneClient, UpstreamEvent } from './lanes';
import type { RateLimiter } from './ratelimit';
import type { TranslationCache } from './cache';

export interface TranslateDeps {
  config: Config;
  lanes: LaneClient[];
  cache: TranslationCache;
  budget: BudgetTracker;
  limiter: RateLimiter;
  breaker: CircuitBreaker;
}

class FirstTokenDeadline extends Error {}

async function nextWithDeadline(
  iterator: AsyncIterator<UpstreamEvent>,
  deadlineMs: number | null
): Promise<IteratorResult<UpstreamEvent>> {
  if (deadlineMs === null) return iterator.next();
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      iterator.next(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new FirstTokenDeadline()), deadlineMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Rough token estimate for abort-path reconciliation (chars/4). */
function estimateUsage(inputChars: number, outputChars: number): Usage {
  return {
    inputTokens: Math.ceil(inputChars / 4),
    outputTokens: Math.ceil(outputChars / 4),
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  };
}

function isDirection(value: unknown): value is Direction {
  return value === 'en2cl' || value === 'cl2en';
}

export function createTranslateHandler(deps: TranslateDeps) {
  const { config, cache, budget, limiter, breaker } = deps;

  return async function handleTranslate(req: Request, res: Response): Promise<void> {
    const requestId = randomUUID().slice(0, 8);

    // Origin gate: CORS protects browsers, not curl. 403 unless the
    // Origin header is allowlisted (REQUIRE_ORIGIN=false is the harness
    // escape hatch).
    const origin = req.headers.origin ?? '';
    const originAllowed = config.allowedOrigins.includes(origin);
    if (config.requireOrigin && !originAllowed) {
      res.status(403).json({ error: 'forbidden_origin' });
      return;
    }
    const allowOrigin = originAllowed ? origin : config.allowedOrigins[0];

    // Validation.
    const body: unknown = req.body;
    const text =
      typeof body === 'object' && body !== null
        ? (body as { text?: unknown }).text
        : undefined;
    const direction =
      typeof body === 'object' && body !== null
        ? (body as { direction?: unknown }).direction
        : undefined;
    if (typeof text !== 'string' || text.length === 0 || !isDirection(direction)) {
      res.status(400).json({ error: 'bad_request' });
      return;
    }
    if (text.length > INPUT_CAP) {
      res.status(413).json({ error: 'input_too_long', max: INPUT_CAP });
      return;
    }

    // Per-IP rate limit.
    const ip = clientIp(
      req.headers['x-forwarded-for'] as string | undefined,
      req.socket?.remoteAddress ?? undefined,
      config.trustedProxyHops
    );
    const decision = limiter.check(ip);
    if (!decision.allowed) {
      logEvent('INFO', 'rate_limited', { requestId, ipHash: hashIp(ip), rateLimited: true });
      res
        .status(429)
        .set('Retry-After', String(Math.ceil((decision.retryAfterMs ?? 60000) / 1000)))
        .json({ error: 'rate_limited', retryAfterMs: decision.retryAfterMs });
      return;
    }

    const normalized = normalizeInput(text);
    if (normalized.length === 0) {
      res.status(400).json({ error: 'bad_request' });
      return;
    }
    const key = cacheKey(direction, PROMPT_VERSION, config.vertexModelId, normalized);
    const sse = new SseStream(res);
    const t0 = Date.now();

    // Server-cache hit: an instant burst, no budget, no lanes.
    const cached = cache.get(key);
    if (cached !== undefined) {
      sse.open(allowOrigin);
      sse.frame({
        type: 'meta',
        lane: 'cache-only',
        cached: true,
        direction,
        promptVersion: PROMPT_VERSION,
      });
      sse.frame({ type: 'token', t: cached });
      sse.frame({
        type: 'done',
        chars: cached.length,
        ttftMs: 0,
        totalMs: Date.now() - t0,
        cached: true,
      });
      sse.end();
      logEvent('INFO', 'translate_done', {
        requestId,
        direction,
        lane: 'cache-only',
        cached: true,
        inputChars: text.length,
        outputChars: cached.length,
        promptVersion: PROMPT_VERSION,
      });
      return;
    }

    // Spend gates: kill switch / tripped budget / no reservation room.
    const reservation: Reservation | null = budget.isCapped() ? null : budget.reserve();
    if (reservation === null) {
      logEvent('WARNING', 'capacity_no_budget', {
        requestId,
        budgetUsedPct: budget.usedPct(),
      });
      res.status(503).json({ error: 'capacity' });
      return;
    }

    const controller = new AbortController();
    let streamedChars = 0;
    let accumulated = '';
    let settled = false;
    const settle = (usage?: Usage) => {
      if (settled) return;
      settled = true;
      if (usage) reservation.reconcile(usage);
      else reservation.release(estimateUsage(text.length, streamedChars));
    };

    // Client-disconnect detection: req 'close' fires when the request
    // BODY completes on Node 20+, which is immediately — useless here.
    // res 'close' fires when the response finishes OR the connection
    // drops; writableEnded/terminated distinguishes the two.
    res.on('close', () => {
      if (sse.terminated || res.writableEnded) return;
      controller.abort();
      sse.abandon();
      settle();
      logEvent('INFO', 'client_closed', { requestId, outputChars: streamedChars });
    });

    // The capacity ladder.
    let committed = false;
    let opened = false;
    let ttftMs = 0;
    let laneAttempts = 0;

    for (const lane of deps.lanes) {
      if (controller.signal.aborted) return;
      if (lane.name === 'cache-only') break; // already missed above
      if (breaker.isOpen(lane.name)) continue;
      laneAttempts++;

      const iterator = lane
        .stream({ text: normalized, direction }, controller.signal)
        [Symbol.asyncIterator]();
      try {
        for (;;) {
          const { value, done } = await nextWithDeadline(
            iterator,
            committed ? null : FIRST_TOKEN_DEADLINE_MS
          );
          if (done) {
            // Stream ended without a stop event: treat as lane failure
            // pre-commit, error post-commit.
            throw new Error('upstream ended without stop');
          }
          const event = value;
          if (event.kind === 'start') {
            if (!opened) {
              opened = true;
              sse.open(allowOrigin);
              sse.frame({
                type: 'meta',
                lane: lane.name,
                cached: false,
                direction,
                promptVersion: PROMPT_VERSION,
              });
            }
          } else if (event.kind === 'text') {
            if (!committed) {
              committed = true;
              ttftMs = Date.now() - t0;
            }
            streamedChars += event.text.length;
            accumulated += event.text;
            sse.frame({ type: 'token', t: event.text });
          } else {
            // stop
            breaker.recordSuccess(lane.name);
            settle(event.usage);
            if (event.stopReason === 'refusal') {
              sse.frame({ type: 'refusal' });
              sse.end();
              logEvent('INFO', 'translate_refused', {
                requestId,
                direction,
                lane: lane.name,
                inputChars: text.length,
                refusalCategory: event.refusalCategory ?? undefined,
                stopReason: 'refusal',
                laneAttempts,
              });
              return;
            }
            sse.frame({
              type: 'done',
              chars: streamedChars,
              ttftMs,
              totalMs: Date.now() - t0,
              cached: false,
            });
            sse.end();
            // Cache only clean, complete successes (never max_tokens truncations).
            if (event.stopReason === 'end_turn' && accumulated.length > 0) {
              cache.set(key, accumulated);
            }
            logEvent('INFO', 'translate_done', {
              requestId,
              direction,
              lane: lane.name,
              cached: false,
              inputChars: text.length,
              outputChars: streamedChars,
              inputTokens: event.usage.inputTokens,
              outputTokens: event.usage.outputTokens,
              cacheReadTokens: event.usage.cacheReadTokens,
              ttftMs,
              totalMs: Date.now() - t0,
              stopReason: event.stopReason ?? undefined,
              promptVersion: PROMPT_VERSION,
              budgetUsedPct: budget.usedPct(),
              laneAttempts,
            });
            return;
          }
        }
      } catch (err) {
        if (controller.signal.aborted) {
          settle();
          return;
        }
        breaker.recordFailure(lane.name);
        const red = redactError(err);
        logEvent('WARNING', 'lane_failed', {
          requestId,
          lane: lane.name,
          errorName: err instanceof FirstTokenDeadline ? 'FirstTokenDeadline' : red.errorName,
          httpStatus: red.httpStatus,
          laneAttempts,
        });
        if (committed) {
          // Post-commit: never re-run a lane. 429/529 reads as capacity.
          const capacityLike = red.httpStatus === 429 || red.httpStatus === 529;
          sse.frame(capacityLike ? { type: 'capacity' } : { type: 'error', code: 'upstream_error' });
          sse.end();
          settle();
          return;
        }
        continue; // silent pre-commit failover
      }
    }

    // Ladder exhausted without a token.
    settle();
    if (opened) {
      sse.frame({ type: 'capacity' });
      sse.end();
    } else {
      res.status(503).json({ error: 'capacity' });
    }
    logEvent('WARNING', 'capacity_ladder_exhausted', { requestId, laneAttempts });
  };
}
