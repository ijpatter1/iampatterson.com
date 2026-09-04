/**
 * claudish-proxy — Express wiring.
 *
 * createApp(deps) is the test seam (integration tests inject FakeLanes
 * and hit a real listening socket). startServer() builds the real
 * dependency graph from env. The JSON body limit is 16kb — an oversized
 * body dies at the parser, before any handler logic (event-stream's
 * bare express.json() defaults to 100kb; tightened here on purpose).
 */
import express from 'express';

import { buildLanes } from './adapters';
import { BudgetTracker } from './budget';
import { TranslationCache } from './cache';
import { loadConfig } from './config';
import { isOriginAllowed } from './config';
import { CircuitBreaker } from './lanes';
import { logEvent } from './log';
import { RateLimiter } from './ratelimit';
import { createTranslateHandler } from './translate';

import type { Express, NextFunction, Request, Response } from 'express';
import type { Config } from './config';
import type { TranslateDeps } from './translate';

export function createApp(deps: TranslateDeps): Express {
  const app = express();
  app.use(express.json({ limit: '16kb' }));

  const { config } = deps;

  app.options('/translate', (req, res) => {
    const origin = req.headers.origin ?? '';
    const allowOrigin = isOriginAllowed(origin, config.allowedOrigins) ? origin : config.allowedOrigins[0];
    res.writeHead(204, {
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    });
    res.end();
  });

  // Express 4 does not catch a rejected async handler; route it to the
  // error handler below instead of letting it become an unhandledRejection
  // that exits the process (review batch 1, finding 1).
  const translate = createTranslateHandler(deps);
  app.post('/translate', (req, res, next) => {
    Promise.resolve(translate(req, res)).catch(next);
  });

  app.all('/translate', (_req, res) => {
    res.status(405).json({ error: 'method_not_allowed' });
  });

  // Ops read-only: budget percentage + lane roster. No upstream calls.
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      budgetUsedPct: deps.budget.usedPct(),
      capped: deps.budget.isCapped(),
      lanes: deps.lanes.map((lane) => lane.name),
    });
  });

  app.use(createErrorHandler(config));

  return app;
}

/**
 * Terminal error handler (review batch 1, finding 5). body-parser rejects
 * (malformed JSON, body over the 16kb limit) and any handler rejection land
 * here. Answers are JSON with the CORS headers the browser needs to read the
 * status; the default Express handler sent text/html with a stack trace and
 * no ACAO, so the client saw an opaque CORS failure. Never echoes err.message.
 */
export function createErrorHandler(config: Config) {
  return (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
    const origin = req.headers.origin ?? '';
    const allowOrigin = isOriginAllowed(origin, config.allowedOrigins) ? origin : config.allowedOrigins[0];
    const type = typeof err === 'object' && err !== null ? (err as { type?: string }).type : undefined;
    const status = type === 'entity.too.large' ? 413 : type === 'entity.parse.failed' ? 400 : 500;
    const body =
      status === 413 ? { error: 'input_too_long' } : status === 400 ? { error: 'bad_request' } : { error: 'internal' };
    logEvent(status === 500 ? 'ERROR' : 'INFO', 'request_error', {
      httpStatus: status,
      errorName: err instanceof Error ? err.constructor.name : 'Unknown',
    });
    if (res.headersSent) {
      // A stream was already open: close it; a status can no longer be sent.
      res.end();
      return;
    }
    res.status(status).set({ 'Access-Control-Allow-Origin': allowOrigin, Vary: 'Origin' }).json(body);
  };
}

export function buildDepsFromEnv(env: NodeJS.ProcessEnv = process.env): TranslateDeps {
  const config = loadConfig(env);
  return {
    config,
    lanes: buildLanes(config, env),
    cache: new TranslationCache(),
    budget: new BudgetTracker(
      config.dailyBudgetUsd / config.maxInstances,
      config.killSwitch,
      (pct) => logEvent('WARNING', 'budget_threshold', { budgetUsedPct: pct })
    ),
    limiter: new RateLimiter(),
    breaker: new CircuitBreaker(),
  };
}

export function startServer(): void {
  const deps = buildDepsFromEnv();
  if (!deps.config.modelIdConfirmed) {
    logEvent('WARNING', 'model_id_unconfirmed', {
      message:
        'MODEL_ID_CONFIRMED != 1 — pinned model IDs have not been verified against Model Garden',
    });
  }
  const app = createApp(deps);
  app.listen(deps.config.port, () => {
    logEvent('INFO', 'server_started', {
      httpStatus: deps.config.port,
      laneAttempts: deps.lanes.length,
    });
  });
}

/* istanbul ignore next -- process entrypoint */
if (require.main === module) {
  startServer();
}
