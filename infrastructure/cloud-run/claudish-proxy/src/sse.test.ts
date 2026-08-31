/**
 * claudish-proxy — SSE writer tests (feat/claudish, proxy T6).
 */
import { SseStream } from './sse';

import type { Response } from 'express';

function stubRes() {
  const writes: string[] = [];
  let ended = 0;
  const res = {
    writeHead: jest.fn(),
    flushHeaders: jest.fn(),
    write: (chunk: string) => {
      writes.push(chunk);
      return true;
    },
    end: () => {
      ended++;
    },
    socket: { setNoDelay: jest.fn() },
  } as unknown as Response;
  return { res, writes, endedCount: () => ended };
}

describe('SseStream', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('opens with unbuffered SSE headers and flushes immediately', () => {
    const { res } = stubRes();
    const stream = new SseStream(res);
    stream.open('https://iampatterson.com');
    expect(res.writeHead).toHaveBeenCalledWith(
      200,
      expect.objectContaining({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': 'https://iampatterson.com',
      })
    );
    expect(res.flushHeaders).toHaveBeenCalled();
    stream.end();
  });

  it('preserves newlines in token text via JSON framing', () => {
    const { res, writes } = stubRes();
    const stream = new SseStream(res);
    stream.open('*');
    stream.frame({ type: 'token', t: 'line one\nline two' });
    expect(writes[0]).toBe('data: {"type":"token","t":"line one\\nline two"}\n\n');
    stream.end();
  });

  it('writes exactly one terminal frame and swallows later frames', () => {
    const { res, writes } = stubRes();
    const stream = new SseStream(res);
    stream.open('*');
    stream.frame({ type: 'token', t: 'a' });
    stream.frame({ type: 'refusal' });
    stream.frame({ type: 'token', t: 'late' });
    stream.frame({ type: 'done', chars: 1, ttftMs: 1, totalMs: 2, cached: false });
    expect(writes.filter((w) => w.includes('refusal'))).toHaveLength(1);
    expect(writes.filter((w) => w.includes('late'))).toHaveLength(0);
    expect(writes.filter((w) => w.includes('"done"'))).toHaveLength(0);
    expect(stream.terminated).toBe(true);
    stream.end();
  });

  it('ends exactly once, idempotently', () => {
    const { res, endedCount } = stubRes();
    const stream = new SseStream(res);
    stream.open('*');
    stream.end();
    stream.end();
    expect(endedCount()).toBe(1);
  });

  it('heartbeats every 15s until ended', () => {
    const { res, writes } = stubRes();
    const stream = new SseStream(res);
    stream.open('*');
    jest.advanceTimersByTime(15000);
    expect(writes.filter((w) => w.startsWith(': keepalive'))).toHaveLength(1);
    stream.end();
    jest.advanceTimersByTime(30000);
    expect(writes.filter((w) => w.startsWith(': keepalive'))).toHaveLength(1);
  });

  it('abandon() stops writes without touching the closed socket', () => {
    const { res, writes, endedCount } = stubRes();
    const stream = new SseStream(res);
    stream.open('*');
    stream.abandon();
    stream.frame({ type: 'token', t: 'x' });
    expect(writes).toHaveLength(0);
    expect(endedCount()).toBe(0);
  });
});
