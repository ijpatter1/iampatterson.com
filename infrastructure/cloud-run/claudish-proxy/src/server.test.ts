/**
 * claudish-proxy — server integration tests (feat/claudish, proxy T10).
 * Real app.listen(0) + fetch, FakeLane injected (event-stream test style):
 * real SSE frames parsed off the wire.
 */
import { BudgetTracker } from './budget';
import { TranslationCache } from './cache';
import { loadConfig } from './config';
import { CircuitBreaker } from './lanes';
import { RateLimiter } from './ratelimit';
import { createApp } from './server';

import type { Server } from 'node:http';
import type { LaneClient, UpstreamEvent } from './lanes';

const OK_USAGE = { inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0 };

function happyLane(): LaneClient {
  return {
    name: 'vertex-global',
    modelId: 'fake',
    async *stream(): AsyncIterable<UpstreamEvent> {
      yield { kind: 'start' };
      yield { kind: 'text', text: 'Hello\nworld' };
      yield { kind: 'stop', stopReason: 'end_turn', usage: OK_USAGE };
    },
  };
}

function makeDeps(lanes: LaneClient[]) {
  return {
    config: loadConfig({}),
    lanes,
    cache: new TranslationCache(),
    budget: new BudgetTracker(23, false),
    limiter: new RateLimiter(),
    breaker: new CircuitBreaker(),
  };
}

let server: Server;
let base: string;

beforeAll(async () => {
  const app = createApp(makeDeps([happyLane()]));
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

const ORIGIN = 'https://iampatterson.com';

describe('POST /translate over the wire', () => {
  it('streams real SSE frames with unbuffered headers', async () => {
    const res = await fetch(`${base}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
      body: JSON.stringify({ text: 'hi there', direction: 'en2cl' }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    expect(res.headers.get('cache-control')).toContain('no-transform');
    expect(res.headers.get('x-accel-buffering')).toBe('no');
    expect(res.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    const body = await res.text();
    const frames = body
      .split('\n\n')
      .filter((b) => b.startsWith('data: '))
      .map((b) => JSON.parse(b.slice(6)) as { type: string; t?: string });
    expect(frames.map((f) => f.type)).toEqual(['meta', 'token', 'done']);
    expect(frames[1].t).toBe('Hello\nworld'); // newline survived framing
  });

  it('rejects an oversized body at the parser', async () => {
    const res = await fetch(`${base}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
      body: JSON.stringify({ text: 'x'.repeat(20000), direction: 'en2cl' }),
    });
    expect(res.status).toBe(413);
  });

  it('answers malformed JSON with a 400 JSON error, CORS headers and no stack trace', async () => {
    // Finding 5: body-parser errors used to reach Express's default handler,
    // which sent text/html with a stack trace and no ACAO header.
    const res = await fetch(`${base}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
      body: 'not json',
    });
    expect(res.status).toBe(400);
    expect(res.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = await res.text();
    expect(JSON.parse(body)).toEqual({ error: 'bad_request' });
    expect(body).not.toContain('node_modules');
  });

  it('answers an oversized body with a 413 JSON error and CORS headers', async () => {
    const res = await fetch(`${base}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
      body: JSON.stringify({ text: 'x'.repeat(20000), direction: 'en2cl' }),
    });
    expect(res.status).toBe(413);
    expect(res.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    expect(await res.json()).toEqual({ error: 'input_too_long' });
  });

  it('405s non-POST methods', async () => {
    const res = await fetch(`${base}/translate`, {
      method: 'GET',
      headers: { Origin: ORIGIN },
    });
    expect(res.status).toBe(405);
  });

  it('answers preflight with the CORS contract', async () => {
    const res = await fetch(`${base}/translate`, {
      method: 'OPTIONS',
      headers: { Origin: ORIGIN },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-methods')).toBe('POST, OPTIONS');
    expect(res.headers.get('access-control-max-age')).toBe('86400');
  });

  it('403s a scripted call without an allowlisted origin', async () => {
    const res = await fetch(`${base}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'hi', direction: 'en2cl' }),
    });
    expect(res.status).toBe(403);
  });
});

describe('GET /health', () => {
  it('reports budget and lanes without touching upstream', async () => {
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe('ok');
    expect(body.capped).toBe(false);
    expect(body.lanes).toEqual(['vertex-global']);
    expect(typeof body.budgetUsedPct).toBe('number');
  });
});
