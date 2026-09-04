/**
 * Claudish translator — SSE frame parser (feat/claudish M2).
 *
 * The client half of the wire contract with claudish-proxy. Every frame is
 * `data: {"type": ...}` JSON (the JSON escape is what makes newlines in
 * translation text framing-safe); `: keepalive` comments are noise;
 * unknown types are ignored (forward compatibility); malformed JSON is
 * skipped, never thrown. parseSseBuffer is a pure string function — no
 * TextDecoder, no ReadableStream — so it tests fully in jsdom.
 */
import { parseSseBuffer } from '@/lib/claudish/sse';
import type { ClaudishFrame } from '@/lib/claudish/sse';

const frame = (obj: unknown) => `data: ${JSON.stringify(obj)}\n\n`;

describe('parseSseBuffer', () => {
  it('parses every frame type in the contract', () => {
    const buffer =
      frame({ type: 'meta', lane: 'vertex-global', cached: false }) +
      frame({ type: 'token', t: 'Hello' }) +
      frame({ type: 'done', chars: 5, ttftMs: 420 }) +
      frame({ type: 'refusal' }) +
      frame({ type: 'capacity' }) +
      frame({ type: 'error', code: 'upstream_error' });
    const { frames, rest } = parseSseBuffer(buffer);
    expect(frames.map((f) => f.type)).toEqual([
      'meta',
      'token',
      'done',
      'refusal',
      'capacity',
      'error',
    ]);
    expect(rest).toBe('');
  });

  it('carries an incomplete frame across chunk boundaries', () => {
    const whole = frame({ type: 'token', t: 'split across chunks' });
    const first = parseSseBuffer(whole.slice(0, 15));
    expect(first.frames).toEqual([]);
    const second = parseSseBuffer(first.rest + whole.slice(15));
    expect(second.frames).toEqual([{ type: 'token', t: 'split across chunks' }]);
    expect(second.rest).toBe('');
  });

  it('preserves newlines inside token text (JSON escape is the framing)', () => {
    const { frames } = parseSseBuffer(frame({ type: 'token', t: 'line one\nline two' }));
    expect((frames[0] as Extract<ClaudishFrame, { type: 'token' }>).t).toBe(
      'line one\nline two'
    );
  });

  it('ignores keepalive comments', () => {
    const { frames, rest } = parseSseBuffer(
      ': keepalive\n\n' + frame({ type: 'token', t: 'x' })
    );
    expect(frames).toEqual([{ type: 'token', t: 'x' }]);
    expect(rest).toBe('');
  });

  it('ignores unknown frame types for forward compatibility', () => {
    const { frames } = parseSseBuffer(
      frame({ type: 'telemetry', v: 1 }) + frame({ type: 'token', t: 'x' })
    );
    expect(frames).toEqual([{ type: 'token', t: 'x' }]);
  });

  it('skips malformed JSON without throwing', () => {
    const { frames } = parseSseBuffer(
      'data: {not json\n\n' + frame({ type: 'token', t: 'x' })
    );
    expect(frames).toEqual([{ type: 'token', t: 'x' }]);
  });

  it('skips a token frame whose t is not a string', () => {
    const { frames } = parseSseBuffer(frame({ type: 'token', t: 42 }));
    expect(frames).toEqual([]);
  });

  it('tolerates CRLF line endings', () => {
    const { frames } = parseSseBuffer('data: {"type":"token","t":"x"}\r\n\r\n');
    expect(frames).toEqual([{ type: 'token', t: 'x' }]);
  });

  it('returns everything as rest when no frame boundary has arrived', () => {
    const { frames, rest } = parseSseBuffer('data: {"type":"tok');
    expect(frames).toEqual([]);
    expect(rest).toBe('data: {"type":"tok');
  });
});
