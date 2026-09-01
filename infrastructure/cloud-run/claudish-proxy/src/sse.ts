/**
 * claudish-proxy — SSE writer with a terminal-frame guarantee.
 *
 * The wire contract's server half: every frame is `data: {json}` with a
 * type discriminator (the JSON escape is what makes newlines in
 * translation text framing-safe), keepalive comments every 15s, and the
 * class-level invariant the client depends on — exactly one terminal
 * frame (done | refusal | capacity | error), then exactly one end().
 * Double terminals and writes-after-end are swallowed, not sent.
 */
import type { Response } from 'express';

export type Frame =
  | {
      type: 'meta';
      lane: string;
      cached: boolean;
      direction: string;
      promptVersion: string;
    }
  | { type: 'token'; t: string }
  | { type: 'done'; chars: number; ttftMs: number; totalMs: number; cached: boolean }
  | { type: 'refusal' }
  | { type: 'capacity' }
  // The loop's in-place replacement: the client clears the target panel
  // and streams the improved translation (revise-then-retokens).
  | { type: 'revise' }
  | { type: 'error'; code: string };

const TERMINAL_TYPES = new Set(['done', 'refusal', 'capacity', 'error']);
export const HEARTBEAT_INTERVAL_MS = 15000;

export class SseStream {
  private terminalSent = false;
  private ended = false;
  private heartbeat: NodeJS.Timeout | null = null;

  constructor(private readonly res: Response) {}

  /** Write status + SSE headers and flush them immediately. */
  private openedOnce = false;

  open(allowOrigin: string): void {
    // Idempotent: the gemini-loop fall-through path reaches the Claude
    // ladder with the stream already open; a second open must not
    // re-write headers or leak a second heartbeat interval.
    if (this.openedOnce) return;
    this.openedOnce = true;
    this.res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': allowOrigin,
      'X-Accel-Buffering': 'no',
    });
    this.res.flushHeaders?.();
    this.res.socket?.setNoDelay(true);
    this.heartbeat = setInterval(() => {
      if (!this.ended) this.res.write(': keepalive\n\n');
    }, HEARTBEAT_INTERVAL_MS);
  }

  frame(frame: Frame): void {
    if (this.ended || this.terminalSent) return;
    if (TERMINAL_TYPES.has(frame.type)) this.terminalSent = true;
    this.res.write(`data: ${JSON.stringify(frame)}\n\n`);
  }

  /** True once a terminal frame has been written. */
  get terminated(): boolean {
    return this.terminalSent;
  }

  /** Idempotent: clears the heartbeat and closes the response once. */
  end(): void {
    if (this.ended) return;
    this.ended = true;
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.res.end();
  }

  /** For req-close cleanup: stop writing without touching the socket. */
  abandon(): void {
    this.ended = true;
    if (this.heartbeat) clearInterval(this.heartbeat);
  }
}
