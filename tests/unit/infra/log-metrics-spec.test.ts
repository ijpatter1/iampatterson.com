/**
 * Log-based metrics, retention and the 24-hour queries (Phase 12, 12.3).
 *
 * Scoped to what the services actually emit (measured 2026-09-04): the
 * proxy's structured `event` field, data-generator's `[ad-insert]` line,
 * Cloud Run's "no available instance" aborts (sGTM logged sixteen in a
 * week), and an event-stream error counter that exists so an error would
 * count even though the service logs none today.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');
const json = <T>(p: string): T => JSON.parse(read(p)) as T;

interface LogMetric {
  name: string;
  description: string;
  filter: string;
  labels?: Record<string, { extractor: string; description: string }>;
}
interface Retention {
  bucket: string;
  retentionDays: number;
  status: string;
  sinks: string[];
}
interface Query {
  service: string;
  filter: string;
}

describe('infrastructure/monitoring/spec/log-metrics.json', () => {
  const metrics = json<LogMetric[]>('infrastructure/monitoring/spec/log-metrics.json');

  it('counts every proxy event the deliverable names, by label, from the proxy service only', () => {
    const m = metrics.find((x) => x.name === 'claudish_proxy_events')!;
    expect(m.filter).toContain('resource.labels.service_name="claudish-proxy"');
    for (const ev of [
      'request_error',
      'loop_fell_through',
      'loop_retry_failed',
      'loop_empty_result',
      'loop_failed_midstream',
      'lane_failed',
      'capacity_ladder_exhausted',
      'budget_threshold',
      'capacity_no_budget',
    ]) {
      expect(m.filter).toContain(ev);
    }
    expect(m.labels?.event.extractor).toBe('EXTRACT(jsonPayload.event)');
  });

  it('counts the data-generator failure line, Cloud Run instance aborts per service, and event-stream errors', () => {
    const names = metrics.map((m) => m.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'data_generator_ad_insert_failures',
        'cloud_run_no_instance',
        'event_stream_errors',
      ]),
    );
    expect(metrics.find((m) => m.name === 'data_generator_ad_insert_failures')!.filter).toContain(
      '[ad-insert]',
    );
    const noInstance = metrics.find((m) => m.name === 'cloud_run_no_instance')!;
    expect(noInstance.filter).toContain('no available instance');
    expect(noInstance.labels?.service.extractor).toBe('EXTRACT(resource.labels.service_name)');
    expect(metrics.find((m) => m.name === 'event_stream_errors')!.description).toMatch(
      /no error logs today/i,
    );
  });

  it('names are unique and valid metric identifiers', () => {
    const names = metrics.map((m) => m.name);
    expect(new Set(names).size).toBe(names.length);
    for (const n of names) expect(n).toMatch(/^[a-z][a-z0-9_]*$/);
  });
});

describe('infrastructure/monitoring/spec/retention.json', () => {
  const r = json<Retention>('infrastructure/monitoring/spec/retention.json');

  it('sets a provisional _Default retention, pending the 13.1 decision, with no sink', () => {
    expect(r.bucket).toBe('_Default');
    expect(r.retentionDays).toBeGreaterThanOrEqual(30);
    expect(r.status).toMatch(/provisional.*13\.1/i);
    expect(r.sinks).toEqual([]);
  });
});

describe('infrastructure/monitoring/spec/queries.json', () => {
  const queries = json<Query[]>('infrastructure/monitoring/spec/queries.json');

  it('carries one "what failed in the last 24 hours" query per service the deliverable names', () => {
    expect(queries.map((q) => q.service).sort()).toEqual([
      'claudish-proxy',
      'data-generator',
      'event-stream',
      'sgtm',
    ]);
    for (const q of queries) {
      expect(q.filter).toContain(`resource.labels.service_name="${q.service}"`);
      expect(q.filter).toMatch(
        /severity>=ERROR|httpRequest\.status>=|jsonPayload\.event|textPayload/,
      );
    }
  });
});

describe('infrastructure/monitoring/apply.sh reconciles metrics and retention', () => {
  const script = read('infrastructure/monitoring/apply.sh');
  it('drives the Logging API for metrics and buckets, and runs the queries in verify', () => {
    expect(script).toContain('logging.googleapis.com/v2/projects/');
    expect(script).toContain('log-metrics.json');
    expect(script).toContain('retention.json');
    expect(script).toContain('queries.json');
  });
});
