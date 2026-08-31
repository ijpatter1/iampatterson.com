/**
 * Claudish translator — fetch-streaming shell (feat/claudish M2).
 *
 * client.ts is the thin bytes layer over the pure SSE parser: POST the
 * request, read the body via getReader(), decode UTF-8 across chunk
 * boundaries, hand frames up. It only ever touches body.getReader(), so
 * a plain object stands in for Response in tests — no real
 * ReadableStream needed in jsdom.
 */
import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from 'util';

// jsdom ships neither; client.ts needs TextDecoder at runtime.
(globalThis as Record<string, unknown>).TextDecoder ??= NodeTextDecoder;
(globalThis as Record<string, unknown>).TextEncoder ??= NodeTextEncoder;

import { streamTranslation } from '@/lib/claudish/client';
import type { ClaudishFrame } from '@/lib/claudish/sse';

const encoder = new NodeTextEncoder();

function readerOf(chunks: string[], opts: { failAfter?: number } = {}) {
  let i = 0;
  let cancelled = false;
  return {
    cancelled: () => cancelled,
    reader: {
      read: async () => {
        if (opts.failAfter !== undefined && i >= opts.failAfter) {
          throw new TypeError('network lost');
        }
        if (i < chunks.length) {
          return { done: false as const, value: encoder.encode(chunks[i++]) };
        }
        return { done: true as const, value: undefined };
      },
      cancel: async () => {
        cancelled = true;
      },
    },
  };
}

const responseWith = (reader: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  body: reader ? { getReader: () => reader } : null,
});

const collect = () => {
  const frames: ClaudishFrame[] = [];
  return { frames, onFrame: (f: ClaudishFrame) => frames.push(f) };
};

describe('streamTranslation', () => {
  it('streams frames split across chunk boundaries, in order', async () => {
    const whole =
      'data: {"type":"meta","lane":"vertex-global"}\n\n' +
      'data: {"type":"token","t":"Hel' /* split inside a frame */ +
      '';
    const rest = 'lo"}\n\ndata: {"type":"done","chars":5}\n\n';
    const { reader } = readerOf([whole, rest]);
    const fetchImpl = jest.fn(async () => responseWith(reader)) as unknown as typeof fetch;
    const { frames, onFrame } = collect();
    const result = await streamTranslation(
      'https://proxy.example/translate',
      { text: 'hi', direction: 'en2cl' },
      new AbortController().signal,
      onFrame,
      fetchImpl
    );
    expect(result).toEqual({ kind: 'ended' });
    expect(frames.map((f) => f.type)).toEqual(['meta', 'token', 'done']);
  });

  it('POSTs JSON with the abort signal wired through', async () => {
    const { reader } = readerOf(['data: {"type":"done"}\n\n']);
    const fetchImpl = jest.fn(async () => responseWith(reader)) as unknown as typeof fetch;
    const controller = new AbortController();
    const { onFrame } = collect();
    await streamTranslation(
      'https://proxy.example/translate',
      { text: 'hello there', direction: 'cl2en' },
      controller.signal,
      onFrame,
      fetchImpl
    );
    const [url, init] = (fetchImpl as jest.Mock).mock.calls[0];
    expect(url).toBe('https://proxy.example/translate');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.signal).toBe(controller.signal);
    expect(JSON.parse(init.body)).toEqual({ text: 'hello there', direction: 'cl2en' });
  });

  it('returns the HTTP status for pre-stream errors without reading a body', async () => {
    const fetchImpl = jest.fn(async () => responseWith(null, 429)) as unknown as typeof fetch;
    const { frames, onFrame } = collect();
    const result = await streamTranslation(
      'u',
      { text: 'x', direction: 'en2cl' },
      new AbortController().signal,
      onFrame,
      fetchImpl
    );
    expect(result).toEqual({ kind: 'http', status: 429 });
    expect(frames).toEqual([]);
  });

  it('reports aborted when the signal fires mid-stream and cancels the reader', async () => {
    const controller = new AbortController();
    let releases: (() => void) | null = null;
    let cancelled = false;
    const reader = {
      read: () =>
        new Promise<never>((_, reject) => {
          releases = () => {
            const err = new Error('aborted');
            (err as Error & { name: string }).name = 'AbortError';
            reject(err);
          };
        }),
      cancel: async () => {
        cancelled = true;
      },
    };
    const fetchImpl = jest.fn(async () => responseWith(reader)) as unknown as typeof fetch;
    const { onFrame } = collect();
    const pending = streamTranslation(
      'u',
      { text: 'x', direction: 'en2cl' },
      controller.signal,
      onFrame,
      fetchImpl
    );
    // Let fetch resolve and the read() call land before aborting.
    await new Promise((r) => setTimeout(r, 0));
    controller.abort();
    (releases as unknown as () => void)();
    const result = await pending;
    expect(result).toEqual({ kind: 'aborted' });
    expect(cancelled).toBe(true);
  });

  it('reports a network failure when fetch itself throws', async () => {
    const fetchImpl = jest.fn(async () => {
      throw new TypeError('failed to fetch');
    }) as unknown as typeof fetch;
    const { onFrame } = collect();
    const result = await streamTranslation(
      'u',
      { text: 'x', direction: 'en2cl' },
      new AbortController().signal,
      onFrame,
      fetchImpl
    );
    expect(result).toEqual({ kind: 'network' });
  });

  it('reports a network failure for a missing body or a mid-stream read error', async () => {
    const noBody = jest.fn(async () => responseWith(null, 200)) as unknown as typeof fetch;
    const { onFrame } = collect();
    expect(
      await streamTranslation('u', { text: 'x', direction: 'en2cl' }, new AbortController().signal, onFrame, noBody)
    ).toEqual({ kind: 'network' });

    const { reader } = readerOf(['data: {"type":"token","t":"a"}\n\n'], { failAfter: 1 });
    const failing = jest.fn(async () => responseWith(reader)) as unknown as typeof fetch;
    const { frames, onFrame: onFrame2 } = collect();
    expect(
      await streamTranslation('u', { text: 'x', direction: 'en2cl' }, new AbortController().signal, onFrame2, failing)
    ).toEqual({ kind: 'network' });
    expect(frames).toEqual([{ type: 'token', t: 'a' }]); // frames before the drop still delivered
  });
});
