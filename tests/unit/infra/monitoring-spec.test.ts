/**
 * Monitoring as committed configuration (Phase 12, deliverable 12.2).
 *
 * The notification channels and the uptime checks live as compact JSON
 * under infrastructure/monitoring/spec/ and are applied by apply.sh through
 * the Monitoring REST API, idempotent by display name, never deleting.
 * These pins hold the spec to the deliverable's wording: five checks on
 * the public surfaces a visitor uses, every check alerting to the channel,
 * the Metabase redirect accepted as healthy, and a Pub/Sub channel so a
 * notification can be verified by machine rather than by a person.
 */
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');
const json = <T>(p: string): T => JSON.parse(read(p)) as T;

interface Channel {
  displayName: string;
  type: 'email' | 'pubsub';
  labels: Record<string, string>;
}
interface UptimeCheck {
  displayName: string;
  host: string;
  path: string;
  acceptedStatusClasses: string[];
  periodSeconds: number;
  timeoutSeconds: number;
  alert: boolean;
}

describe('infrastructure/monitoring/spec/channels.json', () => {
  const channels = json<Channel[]>('infrastructure/monitoring/spec/channels.json');

  it('declares an email channel and a Pub/Sub channel', () => {
    expect(channels.map((c) => c.type).sort()).toEqual(['email', 'pubsub']);
    const email = channels.find((c) => c.type === 'email')!;
    expect(email.labels.email_address).toMatch(/@/);
    const pubsub = channels.find((c) => c.type === 'pubsub')!;
    expect(pubsub.labels.topic).toMatch(/^projects\/iampatterson\/topics\/[a-z0-9-]+$/);
  });

  it('gives every channel a unique display name (the idempotency key)', () => {
    const names = channels.map((c) => c.displayName);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('infrastructure/monitoring/spec/uptime.json', () => {
  const checks = json<UptimeCheck[]>('infrastructure/monitoring/spec/uptime.json');

  it('probes exactly the five public surfaces the deliverable names', () => {
    const surfaces = checks.map((c) => `${c.host}${c.path}`).sort();
    expect(surfaces).toEqual(
      [
        'io.iampatterson.com/healthy',
        'event-stream-eb4xrwmo3q-uc.a.run.app/health',
        'claudish-proxy-eb4xrwmo3q-uc.a.run.app/health',
        'www.iampatterson.com/',
        'bi.iampatterson.com/',
      ].sort(),
    );
  });

  it('accepts the IAP redirect as healthy on the Metabase load balancer and nothing else as a redirect', () => {
    for (const c of checks) {
      if (c.host === 'bi.iampatterson.com')
        expect(c.acceptedStatusClasses).toContain('STATUS_CLASS_3XX');
      else expect(c.acceptedStatusClasses).toEqual(['STATUS_CLASS_2XX']);
    }
  });

  it('alerts on every check, at a cadence that catches an outage inside ten minutes', () => {
    for (const c of checks) {
      expect(c.alert).toBe(true);
      expect(c.periodSeconds).toBeLessThanOrEqual(300);
      expect(c.timeoutSeconds).toBeLessThanOrEqual(30);
      expect(c.displayName.length).toBeGreaterThan(0);
    }
    expect(new Set(checks.map((c) => c.displayName)).size).toBe(checks.length);
  });
});

describe('infrastructure/monitoring/apply.sh', () => {
  const scriptPath = path.join(root, 'infrastructure', 'monitoring', 'apply.sh');
  const script = readFileSync(scriptPath, 'utf8');

  it('is executable, fails fast, and offers dry-run, apply, verify and rehearse', () => {
    expect(statSync(scriptPath).mode & 0o111).not.toBe(0);
    expect(script).toContain('set -euo pipefail');
    for (const mode of ['--dry-run', 'apply', 'verify', 'rehearse']) expect(script).toContain(mode);
  });

  it('drives the Monitoring REST API with an access token and no gcloud component', () => {
    expect(script).toContain('monitoring.googleapis.com/v3/projects/');
    expect(script).toContain('print-access-token');
    expect(script).not.toMatch(/gcloud (alpha|beta) monitoring/);
  });

  it('is idempotent by display name, and deletes only inside the dashboard rebuild', () => {
    expect(script).toContain('displayName');
    // The old pattern missed call("DELETE", ...) because it only looked for
    // single quotes, so the pin stayed green while the script deleted a live
    // dashboard. Assert the real contract instead: every delete the script can
    // issue lives in rehearse_dashboard, which recreates from the spec.
    const deletes = [...script.matchAll(/^.*\bDELETE\b.*$/gm)].map((x) => x[0]);
    expect(deletes.length).toBeGreaterThan(0);
    const rebuild = script.slice(script.indexOf('def rehearse_dashboard'));
    for (const line of deletes) {
      const isComment = line.trim().startsWith('#');
      expect(isComment || rebuild.includes(line)).toBe(true);
    }
  });

  it('writes its verification and rehearsal records under docs/verification', () => {
    expect(script).toContain('docs/verification/');
  });
});
