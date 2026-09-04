/**
 * The operations dashboard as a committed spec (Phase 12, deliverable 12.5).
 *
 * The spec declares tiles; apply.sh generates the mosaic layout, so the spec
 * stays short enough to read in one screen. The deliverable names the signals
 * the dashboard must carry, and its acceptance caps the spec at 300 lines —
 * both are pinned here.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');

interface Series {
  legend: string;
  filter: string;
  aligner: string;
  reducer: string;
  groupBy?: string[];
  period?: string;
}
interface Tile {
  title: string;
  width?: number;
  height?: number;
  series?: Series[];
  logs?: string;
}
interface Spec {
  displayName: string;
  columns: number;
  defaults: { period: string; width: number; height: number };
  tiles: Tile[];
}

const raw = read('infrastructure/monitoring/spec/dashboard.json');
const spec = JSON.parse(raw) as Spec;

describe('infrastructure/monitoring/spec/dashboard.json', () => {
  it('carries every signal the deliverable names', () => {
    const text = spec.tiles
      .flatMap((t) => [t.title, t.logs ?? '', ...(t.series ?? []).map((s) => s.filter)])
      .join('\n');
    for (const needle of [
      'run.googleapis.com/request_count', // request rate and error rate per service
      'run.googleapis.com/request_latencies', // latency per service
      'response_code_class=monitoring.regex.full_match("[45]xx")',
      'pubsub.googleapis.com/topic/send_message_operation_count', // throughput
      'pubsub.googleapis.com/subscription/num_undelivered_messages', // backlog
      'pubsub.googleapis.com/subscription/oldest_unacked_message_age',
      'bigquery.googleapis.com/slots/allocated_for_project', // slot usage
      'bigquery.googleapis.com/query/scanned_bytes_billed', // daily cost
      'cloud_scheduler_job', // scheduler outcomes
      'monitoring.googleapis.com/uptime_check/time_until_ssl_cert_expires', // certificate status
      'metric.labels.event="budget_threshold"', // the proxy's budget crossings
    ]) {
      expect(text).toContain(needle);
    }
  });

  it('breaks the budget crossings out by percentage, which needs the 12.3 metric label', () => {
    const tile = spec.tiles.find((t) => t.title.includes('budget threshold'));
    expect(tile?.series?.[0].groupBy).toEqual(['metric.labels.pct']);
    const metrics = JSON.parse(read('infrastructure/monitoring/spec/log-metrics.json')) as {
      name: string;
      labels: Record<string, { extractor: string }>;
    }[];
    const proxy = metrics.find((m) => m.name === 'claudish_proxy_events');
    expect(proxy?.labels.pct.extractor).toBe('EXTRACT(jsonPayload.budgetUsedPct)');
  });

  it('is well-formed: every tile is a chart or a logs panel, and fits the column count', () => {
    expect(spec.tiles.length).toBeGreaterThan(0);
    for (const t of spec.tiles) {
      expect(t.title.length).toBeGreaterThan(10);
      expect(t.width ?? spec.defaults.width).toBeLessThanOrEqual(spec.columns);
      expect(t.height ?? spec.defaults.height).toBeGreaterThan(0);
      if (t.logs === undefined) {
        expect(t.series?.length).toBeGreaterThan(0);
        for (const s of t.series ?? []) {
          expect(s.filter).toMatch(/^metric\.type=/);
          expect(s.aligner).toMatch(/^ALIGN_/);
          expect(s.reducer).toMatch(/^REDUCE_/);
          expect(s.legend.length).toBeGreaterThan(0);
        }
      } else {
        expect(t.logs).toMatch(/^resource\.type=/);
        expect(t.series).toBeUndefined();
      }
    }
    expect(new Set(spec.tiles.map((t) => t.title)).size).toBe(spec.tiles.length);
  });

  it('stays under 300 lines because the layout is generated, not written out', () => {
    expect(raw.trimEnd().split('\n').length).toBeLessThan(300);
  });
});

describe('infrastructure/monitoring/apply.sh applies the dashboard', () => {
  const script = read('infrastructure/monitoring/apply.sh');
  it('reads the spec, generates the mosaic layout, and can recreate the dashboard from scratch', () => {
    expect(script).toContain('dashboard.json');
    expect(script).toContain('mosaicLayout');
    expect(script).toContain('logsPanel');
    expect(script).toContain('rehearse-dashboard');
  });
});
