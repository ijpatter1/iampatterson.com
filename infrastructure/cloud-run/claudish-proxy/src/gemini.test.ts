/**
 * Gemini client tests — all offline (fake fetch, fake delays).
 */
import { geminiAccessToken, resetGeminiTokenCache, streamGemini } from './gemini';

import type { GeminiConfig, GeminiEvent } from './gemini';

const CONFIG: GeminiConfig = {
  projectId: 'iampatterson',
  location: 'us-central1',
  modelId: 'gemini-2.5-flash',
  temperature: 0.2,
  thinkingBudget: 0,
  maxOutputTokens: 2048,
};

function sse(...chunks: string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(new TextEncoder().encode(c));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

async function collect(iter: AsyncIterable<GeminiEvent>): Promise<GeminiEvent[]> {
  const out: GeminiEvent[] = [];
  for await (const ev of iter) out.push(ev);
  return out;
}

beforeEach(() => resetGeminiTokenCache());

describe('geminiAccessToken', () => {
  it('prefers the env seam, else fetches and caches the metadata token', async () => {
    expect(await geminiAccessToken(undefined as never, { GEMINI_ACCESS_TOKEN: 'tok-env' })).toBe(
      'tok-env',
    );
    let calls = 0;
    const fetchFn = (async () => {
      calls++;
      return new Response(JSON.stringify({ access_token: 'tok-md', expires_in: 600 }), {
        status: 200,
      });
    }) as typeof fetch;
    expect(await geminiAccessToken(fetchFn, {}, 1_000)).toBe('tok-md');
    expect(await geminiAccessToken(fetchFn, {}, 2_000)).toBe('tok-md');
    expect(calls).toBe(1);
    // Past expiry (600s - 60s margin) it refreshes.
    expect(await geminiAccessToken(fetchFn, {}, 1_000 + 541_000)).toBe('tok-md');
    expect(calls).toBe(2);
  });
});

describe('streamGemini', () => {
  const env = process.env;
  beforeEach(() => {
    process.env = { ...env, GEMINI_ACCESS_TOKEN: 'tok' };
  });
  afterEach(() => {
    process.env = env;
  });

  it('yields text deltas and a final stop with usage', async () => {
    const fetchFn = (async (url: unknown) => {
      expect(String(url)).toContain(':streamGenerateContent?alt=sse');
      return sse(
        'data: {"candidates":[{"content":{"parts":[{"text":"Hello "}]}}]}\n\n',
        'data: {"candidates":[{"content":{"parts":[{"text":"world."}]},"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":100,"candidatesTokenCount":5,"cachedContentTokenCount":80}}\n\n',
      );
    }) as typeof fetch;
    const events = await collect(
      streamGemini(
        CONFIG,
        'sys',
        [{ role: 'user', text: 'x' }],
        new AbortController().signal,
        fetchFn,
      ),
    );
    expect(events).toEqual([
      { kind: 'text', text: 'Hello ' },
      { kind: 'text', text: 'world.' },
      {
        kind: 'stop',
        usage: { inputTokens: 100, outputTokens: 5, cachedTokens: 80 },
        finishReason: 'STOP',
      },
    ]);
  });

  it('parses CRLF-delimited frames (the live Vertex wire format)', async () => {
    const fetchFn = (async () =>
      sse(
        'data: {"candidates":[{"content":{"parts":[{"text":"live"}]}}]}\r\n\r\ndata: {"usageMetadata":{"promptTokenCount":7}}\r\n\r\n'
      )) as typeof fetch;
    const events = await collect(
      streamGemini(CONFIG, 'sys', [{ role: 'user', text: 'x' }], new AbortController().signal, fetchFn)
    );
    expect(events[0]).toEqual({ kind: 'text', text: 'live' });
    expect(events[events.length - 1]).toMatchObject({ kind: 'stop' });
  });

  it('handles frames split across network chunks', async () => {
    const fetchFn = (async () =>
      sse(
        'data: {"candidates":[{"content":{"parts":[{"te',
        'xt":"AB"}]}}]}\n\ndata: {"usageMetadata":{"promptTokenCount":1}}\n\n',
      )) as typeof fetch;
    const events = await collect(
      streamGemini(
        CONFIG,
        'sys',
        [{ role: 'user', text: 'x' }],
        new AbortController().signal,
        fetchFn,
      ),
    );
    expect(events[0]).toEqual({ kind: 'text', text: 'AB' });
  });

  it('retries transient 429 before the stream, then succeeds', async () => {
    let calls = 0;
    const delays: number[] = [];
    const fetchFn = (async (url: unknown) => {
      if (String(url).includes('metadata.google.internal')) {
        return new Response(JSON.stringify({ access_token: 't', expires_in: 600 }), {
          status: 200,
        });
      }
      calls++;
      if (calls === 1) return new Response('quota', { status: 429 });
      return sse('data: {"candidates":[{"content":{"parts":[{"text":"ok"}]}}]}\n\n');
    }) as typeof fetch;
    const events = await collect(
      streamGemini(
        CONFIG,
        'sys',
        [{ role: 'user', text: 'x' }],
        new AbortController().signal,
        fetchFn,
        async (ms) => void delays.push(ms),
      ),
    );
    expect(calls).toBe(2);
    expect(delays).toEqual([400]);
    expect(events[0]).toEqual({ kind: 'text', text: 'ok' });
  });

  it('gives up after the retry budget with status-only errors', async () => {
    const fetchFn = (async () =>
      new Response('secret upstream body', { status: 429 })) as typeof fetch;
    await expect(
      collect(
        streamGemini(
          CONFIG,
          'sys',
          [{ role: 'user', text: 'x' }],
          new AbortController().signal,
          fetchFn,
          async () => undefined,
        ),
      ),
    ).rejects.toThrow(/HTTP 429/);
    await expect(
      collect(
        streamGemini(
          CONFIG,
          'sys',
          [{ role: 'user', text: 'x' }],
          new AbortController().signal,
          fetchFn,
          async () => undefined,
        ),
      ),
    ).rejects.not.toThrow(/secret/);
  });

  it('never retries a 400', async () => {
    let calls = 0;
    const fetchFn = (async () => {
      calls++;
      return new Response('bad', { status: 400 });
    }) as typeof fetch;
    await expect(
      collect(
        streamGemini(
          CONFIG,
          'sys',
          [{ role: 'user', text: 'x' }],
          new AbortController().signal,
          fetchFn,
        ),
      ),
    ).rejects.toThrow(/HTTP 400/);
    expect(calls).toBe(1);
  });
});
