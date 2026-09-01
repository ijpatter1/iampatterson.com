/**
 * claudish-proxy — orchestrator tests (feat/claudish, proxy T9).
 *
 * The whole core covered with zero network and zero spend: FakeLane
 * implements LaneClient; req/res are stubs. Every guardrail path is
 * here — origin gate, caps, rate limit, cache, ladder failover with
 * the commit barrier, refusal-is-terminal, abort, kill switch — plus
 * the redaction sweep across all of them.
 */
import { EventEmitter } from 'node:events';

import { BudgetTracker } from './budget';
import { TranslationCache } from './cache';
import { loadConfig } from './config';
import { CircuitBreaker } from './lanes';
import { setLogSink } from './log';
import { RateLimiter } from './ratelimit';
import { createTranslateHandler } from './translate';

import type { Request, Response } from 'express';
import type { LaneClient, LaneRequest, UpstreamEvent } from './lanes';
import type { LaneName } from './config';

const SECRET = 'the confidential input — never in logs';
const OK_USAGE = { inputTokens: 300, outputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0 };

type Script = Array<UpstreamEvent | { kind: 'throw'; err: unknown } | { kind: 'hang' }>;

function fakeLane(name: LaneName, script: Script): LaneClient & { calls: LaneRequest[] } {
  const calls: LaneRequest[] = [];
  return {
    name,
    modelId: 'fake-model',
    calls,
    stream(req: LaneRequest, signal: AbortSignal) {
      calls.push(req);
      let i = 0;
      return {
        [Symbol.asyncIterator]() {
          return {
            async next(): Promise<IteratorResult<UpstreamEvent>> {
              if (signal.aborted) throw new Error('AbortError');
              const step = script[i++];
              if (!step) return { done: true, value: undefined };
              if ('kind' in step && step.kind === 'throw') throw step.err;
              if ('kind' in step && step.kind === 'hang') {
                return new Promise<never>(() => undefined); // never resolves
              }
              return { done: false, value: step as UpstreamEvent };
            },
          };
        },
      };
    },
  };
}

function stubReqRes(body: unknown, headers: Record<string, string> = {}) {
  const req = new EventEmitter() as EventEmitter & Request;
  Object.assign(req, {
    headers: { origin: 'https://iampatterson.com', ...headers },
    body,
    socket: { remoteAddress: '10.0.0.9' },
  });
  const writes: string[] = [];
  let statusCode = 200;
  let jsonBody: unknown = null;
  const headerBag: Record<string, string> = {};
  let endedCount = 0;
  const resEmitter = new EventEmitter();
  const res = {
    on: resEmitter.on.bind(resEmitter),
    emit: resEmitter.emit.bind(resEmitter),
    writableEnded: false,
    writeHead: jest.fn(),
    flushHeaders: jest.fn(),
    socket: { setNoDelay: jest.fn() },
    write: (chunk: string) => {
      writes.push(chunk);
      return true;
    },
    end: () => {
      endedCount++;
      (res as { writableEnded: boolean }).writableEnded = true;
    },
    status(code: number) {
      statusCode = code;
      return this;
    },
    set(name: string, value: string) {
      headerBag[name] = value;
      return this;
    },
    json(payload: unknown) {
      jsonBody = payload;
      return this;
    },
  } as unknown as Response;
  return {
    req,
    res,
    writes,
    frames: () =>
      writes
        .filter((w) => w.startsWith('data: '))
        .map((w) => JSON.parse(w.slice(6)) as { type: string } & Record<string, unknown>),
    status: () => statusCode,
    json: () => jsonBody,
    headers: () => headerBag,
    endedCount: () => endedCount,
  };
}

function makeDeps(lanes: LaneClient[], overrides: Partial<Parameters<typeof createTranslateHandler>[0]> = {}) {
  return {
    config: loadConfig({}),
    lanes,
    cache: new TranslationCache(),
    budget: new BudgetTracker(23, false),
    limiter: new RateLimiter(),
    breaker: new CircuitBreaker(),
    ...overrides,
  };
}

let logLines: string[];
beforeEach(() => {
  logLines = [];
  setLogSink((l) => logLines.push(l));
});

const VALID_BODY = { text: SECRET, direction: 'en2cl' as const };

describe('happy path', () => {
  it('streams meta, tokens, done; caches; reconciles budget', async () => {
    const lane = fakeLane('vertex-global', [
      { kind: 'start' },
      { kind: 'text', text: 'Hello ' },
      { kind: 'text', text: 'world' },
      { kind: 'stop', stopReason: 'end_turn', usage: OK_USAGE },
    ]);
    const deps = makeDeps([lane]);
    const handler = createTranslateHandler(deps);
    const ctx = stubReqRes(VALID_BODY);
    await handler(ctx.req, ctx.res);
    const frames = ctx.frames();
    expect(frames.map((f) => f.type)).toEqual(['meta', 'token', 'token', 'done']);
    expect(frames[0]).toMatchObject({ lane: 'vertex-global', cached: false });
    expect(frames[3]).toMatchObject({ chars: 11, cached: false });
    expect(ctx.endedCount()).toBe(1);
    expect(deps.cache.size).toBe(1);
    expect(deps.budget.usedPct()).toBe(0); // tiny actual usage after reconcile
  });

  it('cl2en: smooths em dashes mechanically and never caches an echo', async () => {
    const lane = fakeLane('vertex-global', [
      { kind: 'start' },
      { kind: 'text', text: 'The fix ' },
      { kind: 'text', text: '— such as it is ' },
      { kind: 'text', text: '— shipped.' },
      { kind: 'stop', stopReason: 'end_turn', usage: OK_USAGE },
    ]);
    const deps = makeDeps([lane]);
    const handler = createTranslateHandler(deps);
    const ctx = stubReqRes({ text: SECRET, direction: 'cl2en' as const });
    await handler(ctx.req, ctx.res);
    const tokens = ctx
      .frames()
      .filter((f) => f.type === 'token')
      .map((f) => String(f.t))
      .join('');
    expect(tokens).toBe('The fix, such as it is, shipped.');
    expect(tokens).not.toContain('—');
    expect(deps.cache.size).toBe(1); // smoothed output is cacheable

    // An echo (output === input) must never be cached.
    const echoLane = fakeLane('vertex-global', [
      { kind: 'start' },
      { kind: 'text', text: 'Echo — me.' },
      { kind: 'stop', stopReason: 'end_turn', usage: OK_USAGE },
    ]);
    const echoDeps = makeDeps([echoLane]);
    const echoHandler = createTranslateHandler(echoDeps);
    const echoCtx = stubReqRes({ text: 'Echo, me.', direction: 'cl2en' as const });
    await echoHandler(echoCtx.req, echoCtx.res);
    // Smoothed 'Echo — me.' becomes 'Echo, me.' — identical to the input.
    expect(echoDeps.cache.size).toBe(0);
  });

  it('serves a repeat input from the cache with no lane call', async () => {
    const lane = fakeLane('vertex-global', [
      { kind: 'start' },
      { kind: 'text', text: 'cached answer' },
      { kind: 'stop', stopReason: 'end_turn', usage: OK_USAGE },
    ]);
    const deps = makeDeps([lane]);
    const handler = createTranslateHandler(deps);
    await handler(...(() => { const c = stubReqRes(VALID_BODY); return [c.req, c.res] as const; })());
    const second = stubReqRes(VALID_BODY);
    await handler(second.req, second.res);
    expect(lane.calls).toHaveLength(1);
    const frames = second.frames();
    expect(frames[0]).toMatchObject({ type: 'meta', cached: true });
    expect(frames[1]).toMatchObject({ type: 'token', t: 'cached answer' });
    expect(frames[2]).toMatchObject({ type: 'done', cached: true, ttftMs: 0 });
  });

  it('does not cache a max_tokens truncation', async () => {
    const lane = fakeLane('vertex-global', [
      { kind: 'start' },
      { kind: 'text', text: 'truncat' },
      { kind: 'stop', stopReason: 'max_tokens', usage: OK_USAGE },
    ]);
    const deps = makeDeps([lane]);
    const ctx = stubReqRes(VALID_BODY);
    await createTranslateHandler(deps)(ctx.req, ctx.res);
    expect(ctx.frames().map((f) => f.type)).toEqual(['meta', 'token', 'done']);
    expect(deps.cache.size).toBe(0);
  });
});

describe('pre-stream rejections', () => {
  it('403s a missing or unknown origin (the curl gate)', async () => {
    const deps = makeDeps([fakeLane('vertex-global', [])]);
    const handler = createTranslateHandler(deps);
    const noOrigin = stubReqRes(VALID_BODY, { origin: '' });
    await handler(noOrigin.req, noOrigin.res);
    expect(noOrigin.status()).toBe(403);
    const badOrigin = stubReqRes(VALID_BODY, { origin: 'https://evil.example' });
    await handler(badOrigin.req, badOrigin.res);
    expect(badOrigin.status()).toBe(403);
  });

  it('400s malformed input and 413s the cap', async () => {
    const handler = createTranslateHandler(makeDeps([fakeLane('vertex-global', [])]));
    for (const body of [null, {}, { text: '', direction: 'en2cl' }, { text: 'x', direction: 'nope' }]) {
      const ctx = stubReqRes(body);
      await handler(ctx.req, ctx.res);
      expect(ctx.status()).toBe(400);
    }
    const big = stubReqRes({ text: 'x'.repeat(1201), direction: 'en2cl' });
    await handler(big.req, big.res);
    expect(big.status()).toBe(413);
    expect(big.json()).toMatchObject({ max: 1200 });
  });

  it('429s past the per-IP limit with Retry-After', async () => {
    const deps = makeDeps([
      fakeLane('vertex-global', [
        { kind: 'start' },
        { kind: 'text', text: 'y' },
        { kind: 'stop', stopReason: 'end_turn', usage: OK_USAGE },
      ]),
    ], { limiter: new RateLimiter({ perMinute: 1, perHour: 10, perDay: 10 }) });
    const handler = createTranslateHandler(deps);
    const first = stubReqRes(VALID_BODY);
    await handler(first.req, first.res);
    const second = stubReqRes({ text: 'different input entirely', direction: 'en2cl' });
    await handler(second.req, second.res);
    expect(second.status()).toBe(429);
    expect(Number(second.headers()['Retry-After'])).toBeGreaterThan(0);
  });

  it('503s capacity when the kill switch is on and the cache misses', async () => {
    const lane = fakeLane('vertex-global', []);
    const deps = makeDeps([lane], { budget: new BudgetTracker(23, true) });
    const ctx = stubReqRes(VALID_BODY);
    await createTranslateHandler(deps)(ctx.req, ctx.res);
    expect(ctx.status()).toBe(503);
    expect(ctx.json()).toEqual({ error: 'capacity' });
    expect(lane.calls).toHaveLength(0);
  });

  it('still serves the cache with the kill switch on', async () => {
    const lane = fakeLane('vertex-global', [
      { kind: 'start' },
      { kind: 'text', text: 'warm answer' },
      { kind: 'stop', stopReason: 'end_turn', usage: OK_USAGE },
    ]);
    const deps = makeDeps([lane]);
    const handler = createTranslateHandler(deps);
    const warm = stubReqRes(VALID_BODY);
    await handler(warm.req, warm.res);
    deps.budget.setKillSwitch(true);
    const hit = stubReqRes(VALID_BODY);
    await handler(hit.req, hit.res);
    expect(hit.frames()[0]).toMatchObject({ cached: true });
  });
});

describe('the ladder', () => {
  it('fails over silently pre-commit on a lane error', async () => {
    const err = Object.assign(new Error(`quota said no: ${SECRET}`), { status: 429 });
    const lane1 = fakeLane('vertex-global', [{ kind: 'throw', err }]);
    const lane2 = fakeLane('vertex-regional', [
      { kind: 'start' },
      { kind: 'text', text: 'from lane 2' },
      { kind: 'stop', stopReason: 'end_turn', usage: OK_USAGE },
    ]);
    const ctx = stubReqRes(VALID_BODY);
    await createTranslateHandler(makeDeps([lane1, lane2]))(ctx.req, ctx.res);
    const frames = ctx.frames();
    expect(frames[0]).toMatchObject({ type: 'meta', lane: 'vertex-regional' });
    expect(frames.map((f) => f.type)).toEqual(['meta', 'token', 'done']);
  });

  it('advances on the first-token deadline when a lane hangs', async () => {
    const hanging = fakeLane('vertex-global', [{ kind: 'start' }, { kind: 'hang' }]);
    const lane2 = fakeLane('anthropic-api', [
      { kind: 'start' },
      { kind: 'text', text: 'rescued' },
      { kind: 'stop', stopReason: 'end_turn', usage: OK_USAGE },
    ]);
    const ctx = stubReqRes(VALID_BODY);
    await createTranslateHandler(makeDeps([hanging, lane2]))(ctx.req, ctx.res);
    const frames = ctx.frames();
    expect(frames.some((f) => f.t === 'rescued')).toBe(true);
  }, 10000);

  it('never advances after the commit barrier: post-commit 429 becomes capacity', async () => {
    const err = Object.assign(new Error('overloaded'), { status: 429 });
    const lane1 = fakeLane('vertex-global', [
      { kind: 'start' },
      { kind: 'text', text: 'partial ' },
      { kind: 'throw', err },
    ]);
    const lane2 = fakeLane('vertex-regional', [
      { kind: 'start' },
      { kind: 'text', text: 'should never run' },
      { kind: 'stop', stopReason: 'end_turn', usage: OK_USAGE },
    ]);
    const ctx = stubReqRes(VALID_BODY);
    await createTranslateHandler(makeDeps([lane1, lane2]))(ctx.req, ctx.res);
    expect(lane2.calls).toHaveLength(0);
    const types = ctx.frames().map((f) => f.type);
    expect(types).toEqual(['meta', 'token', 'capacity']);
  });

  it('post-commit non-quota failure becomes a generic error frame', async () => {
    const lane1 = fakeLane('vertex-global', [
      { kind: 'start' },
      { kind: 'text', text: 'partial' },
      { kind: 'throw', err: new Error('socket reset') },
    ]);
    const ctx = stubReqRes(VALID_BODY);
    await createTranslateHandler(makeDeps([lane1]))(ctx.req, ctx.res);
    expect(ctx.frames().map((f) => f.type)).toEqual(['meta', 'token', 'error']);
  });

  it('503s when every lane fails before any stream opened', async () => {
    const boom = { kind: 'throw' as const, err: new Error('down') };
    const ctx = stubReqRes(VALID_BODY);
    await createTranslateHandler(
      makeDeps([fakeLane('vertex-global', [boom]), fakeLane('anthropic-api', [boom])])
    )(ctx.req, ctx.res);
    expect(ctx.status()).toBe(503);
    expect(ctx.json()).toEqual({ error: 'capacity' });
  });

  it('skips a lane whose circuit is open', async () => {
    const lane1 = fakeLane('vertex-global', [
      { kind: 'start' },
      { kind: 'text', text: 'never' },
      { kind: 'stop', stopReason: 'end_turn', usage: OK_USAGE },
    ]);
    const lane2 = fakeLane('anthropic-api', [
      { kind: 'start' },
      { kind: 'text', text: 'via lane 2' },
      { kind: 'stop', stopReason: 'end_turn', usage: OK_USAGE },
    ]);
    const breaker = new CircuitBreaker(1, 60000);
    breaker.recordFailure('vertex-global');
    const ctx = stubReqRes(VALID_BODY);
    await createTranslateHandler(makeDeps([lane1, lane2], { breaker }))(ctx.req, ctx.res);
    expect(lane1.calls).toHaveLength(0);
    expect(ctx.frames()[0]).toMatchObject({ lane: 'anthropic-api' });
  });
});

describe('refusal', () => {
  it('is terminal: refusal frame, no done, not cached, no failover, category logged', async () => {
    const lane1 = fakeLane('vertex-global', [
      { kind: 'start' },
      { kind: 'text', text: 'partial before refusal' },
      { kind: 'stop', stopReason: 'refusal', refusalCategory: 'general_harms', usage: OK_USAGE },
    ]);
    const lane2 = fakeLane('vertex-regional', []);
    const deps = makeDeps([lane1, lane2]);
    const ctx = stubReqRes(VALID_BODY);
    await createTranslateHandler(deps)(ctx.req, ctx.res);
    const types = ctx.frames().map((f) => f.type);
    expect(types).toEqual(['meta', 'token', 'refusal']);
    expect(lane2.calls).toHaveLength(0);
    expect(deps.cache.size).toBe(0);
    expect(logLines.join('\n')).toContain('general_harms');
  });
});

describe('client abort', () => {
  it('aborts the upstream signal and stops writing', async () => {
    let seenSignal: AbortSignal | null = null;
    const lane: LaneClient = {
      name: 'vertex-global',
      modelId: 'fake',
      stream(_req, signal) {
        seenSignal = signal;
        return {
          [Symbol.asyncIterator]() {
            let sent = false;
            return {
              async next(): Promise<IteratorResult<UpstreamEvent>> {
                if (!sent) {
                  sent = true;
                  return { done: false, value: { kind: 'start' } };
                }
                return new Promise(() => undefined); // hang until abort
              },
            };
          },
        };
      },
    };
    const ctx = stubReqRes(VALID_BODY);
    const pending = createTranslateHandler(makeDeps([lane]))(ctx.req, ctx.res);
    await new Promise((r) => setTimeout(r, 20));
    (ctx.res as unknown as EventEmitter).emit('close');
    await new Promise((r) => setTimeout(r, 5));
    expect(seenSignal).not.toBeNull();
    expect((seenSignal as unknown as AbortSignal).aborted).toBe(true);
    void pending; // the handler stays parked on the hung read; the abort did its job
  });
});

describe('redaction sweep', () => {
  it('never logs the input or output text on any path', async () => {
    const happy = fakeLane('vertex-global', [
      { kind: 'start' },
      { kind: 'text', text: 'OUTPUT-TEXT-MARKER' },
      { kind: 'stop', stopReason: 'end_turn', usage: OK_USAGE },
    ]);
    const handler = createTranslateHandler(makeDeps([happy]));
    const a = stubReqRes(VALID_BODY);
    await handler(a.req, a.res);

    const refusing = fakeLane('vertex-global', [
      { kind: 'start' },
      { kind: 'stop', stopReason: 'refusal', refusalCategory: null, usage: OK_USAGE },
    ]);
    const b = stubReqRes({ text: SECRET, direction: 'cl2en' });
    await createTranslateHandler(makeDeps([refusing]))(b.req, b.res);

    const failing = fakeLane('vertex-global', [
      { kind: 'throw', err: new Error(`boom with body: ${SECRET}`) },
    ]);
    const c = stubReqRes(VALID_BODY);
    await createTranslateHandler(makeDeps([failing]))(c.req, c.res);

    const all = logLines.join('\n');
    expect(all).not.toContain(SECRET);
    expect(all).not.toContain('OUTPUT-TEXT-MARKER');
    expect(all).not.toContain('confidential');
  });
});

describe('FORCE_REFUSAL_TOKEN injection hook (staging smoke, never production)', () => {
  it('synthesizes a refusal stream without touching any lane', async () => {
    const lane = fakeLane('vertex-global', [
      { kind: 'start' },
      { kind: 'text', text: 'never' },
      { kind: 'stop', stopReason: 'end_turn', usage: OK_USAGE },
    ]);
    const deps = makeDeps([lane], {
      config: loadConfig({ FORCE_REFUSAL_TOKEN: 'REFUSE-ME-TOKEN' }),
    });
    const ctx = stubReqRes({ text: 'REFUSE-ME-TOKEN', direction: 'en2cl' });
    await createTranslateHandler(deps)(ctx.req, ctx.res);
    expect(ctx.frames().map((f) => f.type)).toEqual(['meta', 'refusal']);
    expect(lane.calls).toHaveLength(0);
  });

  it('is inert when the env is unset', async () => {
    const lane = fakeLane('vertex-global', [
      { kind: 'start' },
      { kind: 'text', text: 'normal' },
      { kind: 'stop', stopReason: 'end_turn', usage: OK_USAGE },
    ]);
    const ctx = stubReqRes({ text: 'REFUSE-ME-TOKEN', direction: 'en2cl' });
    await createTranslateHandler(makeDeps([lane]))(ctx.req, ctx.res);
    expect(ctx.frames().map((f) => f.type)).toEqual(['meta', 'token', 'done']);
  });
});

describe('CORS on pre-stream errors (CR2)', () => {
  it.each([
    ['403 forbidden origin', { origin: 'https://evil.example' }, { text: 'x', direction: 'en2cl' }],
    ['400 bad request', {}, { text: '', direction: 'en2cl' }],
    ['413 over cap', {}, { text: 'x'.repeat(1300), direction: 'en2cl' }],
  ])('sets ACAO on %s so the browser can read the status', async (_label, headers, body) => {
    const ctx = stubReqRes(body, headers as Record<string, string>);
    await createTranslateHandler(makeDeps([fakeLane('vertex-global', [])]))(ctx.req, ctx.res);
    expect(ctx.headers()['Access-Control-Allow-Origin']).toBeTruthy();
    expect(ctx.headers()['Vary']).toBe('Origin');
  });

  it('sets ACAO on 429 and capacity 503', async () => {
    const deps = makeDeps([fakeLane('vertex-global', [])], {
      limiter: new RateLimiter({ perMinute: 0, perHour: 1, perDay: 1 }),
    });
    const limited = stubReqRes(VALID_BODY);
    await createTranslateHandler(deps)(limited.req, limited.res);
    expect(limited.status()).toBe(429);
    expect(limited.headers()['Access-Control-Allow-Origin']).toBeTruthy();

    const capped = stubReqRes(VALID_BODY);
    await createTranslateHandler(
      makeDeps([fakeLane('vertex-global', [])], { budget: new BudgetTracker(23, true) })
    )(capped.req, capped.res);
    expect(capped.status()).toBe(503);
    expect(capped.headers()['Access-Control-Allow-Origin']).toBeTruthy();
  });
});

describe('lane cleanup on failover (CR3)', () => {
  it('aborts the losing lane at the first-token deadline so it stops generating', async () => {
    const signals: AbortSignal[] = [];
    const hanging: LaneClient = {
      name: 'vertex-global',
      modelId: 'fake',
      stream(_req, signal) {
        signals.push(signal);
        return {
          [Symbol.asyncIterator]() {
            let sent = false;
            return {
              async next(): Promise<IteratorResult<UpstreamEvent>> {
                if (!sent) {
                  sent = true;
                  return { done: false, value: { kind: 'start' } };
                }
                return new Promise(() => undefined); // stalls past the deadline
              },
            };
          },
        };
      },
    };
    const rescue = fakeLane('anthropic-api', [
      { kind: 'start' },
      { kind: 'text', text: 'rescued' },
      { kind: 'stop', stopReason: 'end_turn', usage: OK_USAGE },
    ]);
    const ctx = stubReqRes(VALID_BODY);
    await createTranslateHandler(makeDeps([hanging, rescue]))(ctx.req, ctx.res);
    expect(ctx.frames().some((f) => f.t === 'rescued')).toBe(true);
    expect(signals[0].aborted).toBe(true); // the loser was cancelled, not orphaned
  }, 10000);

  it('aborts the failed lane on a pre-commit throw as well', async () => {
    const signals: AbortSignal[] = [];
    const failing: LaneClient = {
      name: 'vertex-global',
      modelId: 'fake',
      stream(_req, signal) {
        signals.push(signal);
        return {
          [Symbol.asyncIterator]() {
            return {
              async next(): Promise<IteratorResult<UpstreamEvent>> {
                throw new Error('down');
              },
            };
          },
        };
      },
    };
    const rescue = fakeLane('anthropic-api', [
      { kind: 'start' },
      { kind: 'text', text: 'ok' },
      { kind: 'stop', stopReason: 'end_turn', usage: OK_USAGE },
    ]);
    const ctx = stubReqRes(VALID_BODY);
    await createTranslateHandler(makeDeps([failing, rescue]))(ctx.req, ctx.res);
    expect(signals[0].aborted).toBe(true);
  });
});

describe('cl2en gemini-loop engine', () => {
  const LOUD_OUT =
    "This isn't just a refactor — it's a robust, seamless transformation, underscoring the fundamental shift in how the pipeline thinks about state.";
  const CLEAN_OUT = 'You were right to send both fixes, because the first one failed.';

  function scriptedGemini(outputs: string[], failFirst = false) {
    let call = 0;
    const geminiStream = ((..._args: unknown[]) => {
      call++;
      if (failFirst && call === 1) {
        return (async function* () {
          throw new Error('gemini upstream HTTP 500');
          yield undefined as never;
        })();
      }
      const text = outputs[Math.min(call - (failFirst ? 2 : 1), outputs.length - 1)];
      return (async function* () {
        yield { kind: 'text', text } as const;
        yield {
          kind: 'stop',
          usage: { inputTokens: 100, outputTokens: 20, cachedTokens: 0 },
          finishReason: 'STOP',
        } as const;
      })();
    }) as never;
    return { geminiStream, calls: () => call };
  }

  function loopDeps(outputs: string[], failFirst = false) {
    const scripted = scriptedGemini(outputs, failFirst);
    const lane = fakeLane('vertex-global', [
      { kind: 'start' },
      { kind: 'text', text: 'ladder fallback' },
      { kind: 'stop', stopReason: 'end_turn', usage: OK_USAGE },
    ]);
    const deps = makeDeps([lane]);
    deps.config = loadConfig({ CL2EN_ENGINE: 'gemini-loop', LANES: 'vertex-global,cache-only' });
    (deps as { geminiStream?: unknown }).geminiStream = scripted.geminiStream;
    return { deps, scripted };
  }

  it('clean attempt streams through the loop: meta gemini-loop, token, done; cached', async () => {
    const { deps } = loopDeps([CLEAN_OUT]);
    const handler = createTranslateHandler(deps);
    const ctx = stubReqRes({ text: 'x '.repeat(20), direction: 'cl2en' as const });
    await handler(ctx.req, ctx.res);
    const frames = ctx.frames();
    expect(frames.map((f) => f.type)).toEqual(['meta', 'token', 'done']);
    expect(frames[0]).toMatchObject({ lane: 'gemini-loop' });
    expect(frames[1]).toMatchObject({ t: CLEAN_OUT });
    expect(deps.cache.size).toBe(1);
  });

  it('convicted-then-improved emits revise and serves the retry', async () => {
    const { deps, scripted } = loopDeps([LOUD_OUT, CLEAN_OUT]);
    const handler = createTranslateHandler(deps);
    const ctx = stubReqRes({ text: 'y '.repeat(20), direction: 'cl2en' as const });
    await handler(ctx.req, ctx.res);
    const types = ctx.frames().map((f) => f.type);
    expect(types).toEqual(['meta', 'token', 'revise', 'token', 'done']);
    expect(scripted.calls()).toBe(2);
    const tokens = ctx.frames().filter((f) => f.type === 'token');
    expect(tokens[tokens.length - 1]).toMatchObject({ t: CLEAN_OUT });
  });

  it('pre-token gemini failure falls through to the Claude ladder', async () => {
    const { deps } = loopDeps([CLEAN_OUT], true);
    const handler = createTranslateHandler(deps);
    const ctx = stubReqRes({ text: 'z '.repeat(20), direction: 'cl2en' as const });
    await handler(ctx.req, ctx.res);
    const frames = ctx.frames();
    // Two metas: the loop's, then the ladder's — last wins client-side.
    expect(frames.filter((f) => f.type === 'meta').length).toBe(2);
    expect(frames.some((f) => f.type === 'token' && f.t === 'ladder fallback')).toBe(true);
    expect(frames[frames.length - 1].type).toBe('done');
  });

  it('en2cl never touches the loop even with the engine on', async () => {
    const { deps, scripted } = loopDeps([CLEAN_OUT]);
    const handler = createTranslateHandler(deps);
    const ctx = stubReqRes({ text: 'w '.repeat(20), direction: 'en2cl' as const });
    await handler(ctx.req, ctx.res);
    expect(scripted.calls()).toBe(0);
    expect(ctx.frames()[0]).toMatchObject({ lane: 'vertex-global' });
  });
});

describe('long-form loop budget + convicted-cache gate', () => {
  it('does not cache a convicted serving with live actionable evidence', async () => {
    const LOUD_OUT =
      "This isn't just a refactor — it's a robust, seamless transformation, underscoring the fundamental shift in how the pipeline thinks about state.";
    const scripted = ((..._a: unknown[]) =>
      (async function* () {
        yield { kind: 'text', text: LOUD_OUT } as const;
        yield {
          kind: 'stop',
          usage: { inputTokens: 100, outputTokens: 20, cachedTokens: 0 },
          finishReason: 'STOP',
        } as const;
      })()) as never;
    const lane = fakeLane('vertex-global', [
      { kind: 'start' },
      { kind: 'text', text: 'x' },
      { kind: 'stop', stopReason: 'end_turn', usage: OK_USAGE },
    ]);
    const deps = makeDeps([lane]);
    deps.config = loadConfig({ CL2EN_ENGINE: 'gemini-loop', LANES: 'vertex-global,cache-only' });
    (deps as { geminiStream?: unknown }).geminiStream = scripted;
    const handler = createTranslateHandler(deps);
    const ctx = stubReqRes({ text: 'q '.repeat(20), direction: 'cl2en' as const });
    await handler(ctx.req, ctx.res);
    // Convicted + actionable on every attempt: nothing gets pinned.
    expect(deps.cache.size).toBe(0);
  });
});
