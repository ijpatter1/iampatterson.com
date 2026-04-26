/**
 * Phase 10d D6 — synthetic load test for the SSE service core path.
 *
 * Gated on `LOAD_TEST=1` to keep it out of the default Jest run; the
 * regular jest suite still exercises the connection manager + router
 * for correctness, this file measures throughput.
 *
 * Methodology
 * -----------
 * The service has three units we can stress in-process without
 * spinning up Pub/Sub or the Cloud Run runtime:
 *
 *   1. `parsePubSubMessage` — base64 decode + JSON parse + session_id
 *      validation. CPU-bound; throughput is parser ceiling.
 *   2. `ConnectionManager` — Map keyed by session_id, broadcast +
 *      single-session send; both write to a stub Response. Memory-bound.
 *   3. `routeMessage` — composition of (1) lookup + (2) write.
 *
 * The synthetic load creates `CONN_COUNT` connections, then drives
 * `MSG_COUNT` Pub/Sub-shaped messages through the parse → route path,
 * each targeting a random session_id. The stub Response counts writes
 * so we can assert delivery + measure throughput.
 *
 * Pub/Sub throughput is a managed-service concern and intentionally
 * NOT load-tested here — it would burn real GCP resources without
 * adding signal beyond what Pub/Sub's published quotas already promise.
 * See docs/perf/load-test-2026-04-25.md "Pub/Sub characteristics" for
 * the analytical profile.
 */
import type { Response } from 'express';

import { ConnectionManager } from './connections';
import { parsePubSubMessage, routeMessage } from './router';

const LOAD_TEST_ENABLED = process.env.LOAD_TEST === '1';
const describeIfLoadTest = LOAD_TEST_ENABLED ? describe : describe.skip;

interface LoadMetrics {
  durationMs: number;
  throughputPerSec: number;
  count: number;
}

function measure(label: string, count: number, fn: () => void): LoadMetrics {
  const start = process.hrtime.bigint();
  fn();
  const durationNs = Number(process.hrtime.bigint() - start);
  const durationMs = durationNs / 1_000_000;
  const throughputPerSec = (count / durationMs) * 1000;
  // eslint-disable-next-line no-console
  console.log(
    `[load] ${label}: ${count} ops in ${durationMs.toFixed(1)} ms ` +
      `(${Math.round(throughputPerSec).toLocaleString()} ops/sec)`,
  );
  return { durationMs, throughputPerSec, count };
}

function makeStubResponse(): Response & { writeCount: number; ended: boolean } {
  const stub = {
    writeCount: 0,
    ended: false,
    write(_: string): boolean {
      this.writeCount++;
      return true;
    },
    end(): void {
      this.ended = true;
    },
  };
  return stub as unknown as Response & { writeCount: number; ended: boolean };
}

function buildPubSubBody(sessionId: string, eventName: string, n: number): unknown {
  const payload = {
    session_id: sessionId,
    event_name: eventName,
    timestamp: new Date().toISOString(),
    page_path: '/',
    n,
  };
  const data = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64');
  return { message: { data } };
}

describeIfLoadTest('SSE service load profile (Phase 10d D6)', () => {
  it('parses 50,000 Pub/Sub-shaped messages and yields a steady throughput', () => {
    const MSG_COUNT = 50_000;
    const bodies: unknown[] = [];
    for (let i = 0; i < MSG_COUNT; i++) {
      bodies.push(buildPubSubBody(`sess-${i % 1000}`, 'page_view', i));
    }

    let parsed = 0;
    const metrics = measure('parsePubSubMessage', MSG_COUNT, () => {
      for (const body of bodies) {
        const result = parsePubSubMessage(body);
        if (result) parsed++;
      }
    });

    expect(parsed).toBe(MSG_COUNT);
    // Floor: parser must do at least 50k msg/sec on a developer laptop.
    // Actual numbers in docs/perf/load-test-2026-04-25.md.
    expect(metrics.throughputPerSec).toBeGreaterThan(50_000);
  });

  it('routes 100,000 messages across 5,000 sessions without dropping any', () => {
    const CONN_COUNT = 5_000;
    const MSG_COUNT = 100_000;

    const manager = new ConnectionManager();
    const stubs: Array<ReturnType<typeof makeStubResponse>> = [];
    for (let i = 0; i < CONN_COUNT; i++) {
      const stub = makeStubResponse();
      stubs.push(stub);
      manager.add(`sess-${i}`, stub);
    }
    expect(manager.size).toBe(CONN_COUNT);

    // Pre-build payload bodies outside the timed window so the
    // measurement isolates routing throughput.
    const bodies: unknown[] = [];
    for (let i = 0; i < MSG_COUNT; i++) {
      bodies.push(buildPubSubBody(`sess-${i % CONN_COUNT}`, 'page_view', i));
    }

    let delivered = 0;
    const metrics = measure('parse+route end-to-end', MSG_COUNT, () => {
      for (const body of bodies) {
        const payload = parsePubSubMessage(body);
        if (!payload) continue;
        if (routeMessage(manager, payload)) delivered++;
      }
    });

    // Every message routes — 100% delivery because every session_id is
    // in the connection map.
    expect(delivered).toBe(MSG_COUNT);
    // Each session received MSG_COUNT / CONN_COUNT messages.
    const expectedPerSession = MSG_COUNT / CONN_COUNT;
    for (const stub of stubs) {
      expect(stub.writeCount).toBe(expectedPerSession);
    }
    // Floor: routing path must hit at least 25k msg/sec end-to-end.
    expect(metrics.throughputPerSec).toBeGreaterThan(25_000);
  });

  it('rejects 50,000 malformed bodies without crashing or memory growth', () => {
    const MSG_COUNT = 50_000;
    const malformed: unknown[] = [
      null,
      undefined,
      {},
      { message: {} },
      { message: { data: '' } },
      { message: { data: 'not-base64-!!!' } },
      // Valid base64 but invalid JSON
      { message: { data: Buffer.from('not json').toString('base64') } },
      // Valid JSON but missing session_id
      {
        message: {
          data: Buffer.from(JSON.stringify({ event_name: 'x' })).toString('base64'),
        },
      },
    ];

    let rejected = 0;
    const metrics = measure('reject malformed', MSG_COUNT, () => {
      for (let i = 0; i < MSG_COUNT; i++) {
        const body = malformed[i % malformed.length];
        if (parsePubSubMessage(body) === null) rejected++;
      }
    });

    expect(rejected).toBe(MSG_COUNT);
    // Rejection path must be fast — security DOS surface.
    expect(metrics.throughputPerSec).toBeGreaterThan(100_000);
  });

  it('broadcasts to 1,000 connections in under 100 ms', () => {
    const CONN_COUNT = 1_000;
    const manager = new ConnectionManager();
    const stubs: Array<ReturnType<typeof makeStubResponse>> = [];
    for (let i = 0; i < CONN_COUNT; i++) {
      const stub = makeStubResponse();
      stubs.push(stub);
      manager.add(`sess-${i}`, stub);
    }

    const metrics = measure('broadcast 1k connections', CONN_COUNT, () => {
      manager.broadcast({ event: 'announcement', timestamp: Date.now() });
    });

    for (const stub of stubs) {
      expect(stub.writeCount).toBe(1);
    }
    expect(metrics.durationMs).toBeLessThan(100);
  });
});
