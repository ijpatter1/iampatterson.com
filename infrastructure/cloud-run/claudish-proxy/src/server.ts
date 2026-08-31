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
import { CircuitBreaker } from './lanes';
import { logEvent } from './log';
import { RateLimiter } from './ratelimit';
import { createTranslateHandler } from './translate';

import type { Express } from 'express';
import type { TranslateDeps } from './translate';

export function createApp(deps: TranslateDeps): Express {
  const app = express();
  app.use(express.json({ limit: '16kb' }));

  const { config } = deps;

  app.options('/translate', (req, res) => {
    const origin = req.headers.origin ?? '';
    const allowOrigin = config.allowedOrigins.includes(origin)
      ? origin
      : config.allowedOrigins[0];
    res.writeHead(204, {
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    });
    res.end();
  });

  app.post('/translate', createTranslateHandler(deps));

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

  return app;
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
