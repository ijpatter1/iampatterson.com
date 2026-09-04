/**
 * Alerting policies as committed specs (Phase 12, deliverable 12.4).
 *
 * Each policy names a documented threshold, a firing record or a written
 * reason it cannot be fired safely, and the runbook entry that will own it
 * (13.5). The pins hold the spec to the deliverable's list.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');

interface Policy {
  displayName: string;
  kind: 'threshold' | 'log';
  filter?: string;
  logFilter?: string;
  aggregations?: unknown[];
  comparison?: string;
  thresholdValue?: number;
  duration?: string;
  threshold: string;
  firing: string;
  runbook: string;
}

const policies = JSON.parse(read('infrastructure/monitoring/spec/policies.json')) as Policy[];

describe('infrastructure/monitoring/spec/policies.json', () => {
  it('covers every signal the deliverable names', () => {
    const text = policies
      .map((p) => `${p.displayName} ${p.filter ?? ''} ${p.logFilter ?? ''}`)
      .join('\n');
    for (const needle of [
      'response_code_class="5xx"',
      'failed to start',
      'oldest_unacked_message_age',
      'num_undelivered_messages',
      'cloud_scheduler_job',
      'dataform.googleapis.com',
      'scanned_bytes_billed',
      'metric.labels.event="budget_threshold"',
      'metric.labels.event="capacity_no_budget"',
      'time_until_ssl_cert_expires',
    ]) {
      expect(text).toContain(needle);
    }
  });

  it('names the push subscription for the Pub/Sub policies and the 12.3 metrics for the log-derived ones', () => {
    for (const p of policies.filter((x) => x.filter?.includes('pubsub.googleapis.com'))) {
      expect(p.filter).toContain('resource.labels.subscription_id="iampatterson-events-push"');
    }
    for (const p of policies.filter((x) => x.filter?.includes('logging.googleapis.com/user/'))) {
      expect(p.filter).toMatch(
        /logging\.googleapis\.com\/user\/(claudish_proxy_events|cloud_run_no_instance)/,
      );
    }
  });

  it('documents a threshold, a firing record or a safety reason, and a runbook entry on every policy', () => {
    for (const p of policies) {
      expect(p.threshold.length).toBeGreaterThan(20);
      expect(p.firing).toMatch(/fired|expected to fire|cannot be fired safely/);
      expect(p.runbook).toContain('13.5');
    }
  });

  it('is well-formed per kind and unique by display name', () => {
    for (const p of policies) {
      if (p.kind === 'threshold') {
        expect(p.filter).toMatch(/^metric\.type=/);
        expect(Array.isArray(p.aggregations)).toBe(true);
        expect(p.comparison).toMatch(/^COMPARISON_(GT|LT)$/);
        expect(typeof p.thresholdValue).toBe('number');
        expect(p.duration).toMatch(/^\d+s$/);
      } else {
        expect(p.logFilter).toMatch(/^resource\.type=/);
      }
    }
    expect(new Set(policies.map((p) => p.displayName)).size).toBe(policies.length);
  });
});

describe('infrastructure/monitoring/apply.sh reconciles the policies', () => {
  const script = read('infrastructure/monitoring/apply.sh');
  it('reads policies.json, supports log-match conditions, and can fire the capacity policy on purpose', () => {
    expect(script).toContain('policies.json');
    expect(script).toContain('conditionMatchedLog');
    expect(script).toContain('rehearse-policy');
    expect(script).toContain('KILL_SWITCH');
  });
});
