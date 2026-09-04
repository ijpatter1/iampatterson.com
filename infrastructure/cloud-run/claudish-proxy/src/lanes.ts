/**
 * claudish-proxy — lane abstraction + circuit breaker.
 *
 * LaneClient is the seam that makes the whole service testable with
 * zero network: the orchestrator consumes AsyncIterable<UpstreamEvent>
 * and never touches an SDK type. Real adapters (vertex, anthropic) are
 * thin translations of the Anthropic streaming shape into these three
 * events. The circuit breaker keeps a dead lane from taxing every
 * request with a failed round trip.
 */
import type { Direction, LaneName } from './config';
import type { Usage } from './budget';

export type UpstreamEvent =
  | { kind: 'start' }
  | { kind: 'text'; text: string }
  | {
      kind: 'stop';
      stopReason: string | null;
      /** stop_details.category when the model refused; never the explanation. */
      refusalCategory?: string | null;
      usage: Usage;
    };

export interface LaneRequest {
  text: string;
  direction: Direction;
}

export interface LaneClient {
  name: LaneName;
  modelId: string;
  stream(req: LaneRequest, signal: AbortSignal): AsyncIterable<UpstreamEvent>;
}

export class CircuitBreaker {
  private failures = new Map<string, number>();
  private openedAt = new Map<string, number>();

  constructor(
    private readonly threshold = 3,
    private readonly cooldownMs = 30000
  ) {}

  isOpen(lane: string, now: number = Date.now()): boolean {
    const opened = this.openedAt.get(lane);
    if (opened === undefined) return false;
    if (now - opened >= this.cooldownMs) {
      // Half-open: allow one probe attempt.
      this.openedAt.delete(lane);
      this.failures.set(lane, this.threshold - 1);
      return false;
    }
    return true;
  }

  recordSuccess(lane: string): void {
    this.failures.delete(lane);
    this.openedAt.delete(lane);
  }

  recordFailure(lane: string, now: number = Date.now()): void {
    const count = (this.failures.get(lane) ?? 0) + 1;
    this.failures.set(lane, count);
    if (count >= this.threshold) {
      this.openedAt.set(lane, now);
    }
  }
}
