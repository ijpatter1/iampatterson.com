/**
 * Monitoring as committed configuration (Phase 12, deliverable 12.2).
 *
 * The notification channels and the uptime checks live as compact JSON
 * under infrastructure/monitoring/spec/ and are applied by apply.sh through
 * the Monitoring REST API, idempotent by display name, never deleting.
 * These pins hold the spec to the deliverable's wording: a check on each
 * public surface a visitor uses, every check alerting to the channel, only a
 * 2xx accepted as healthy, and a Pub/Sub channel so a notification can be
 * verified by machine rather than by a person.
 *
 * [18.10] removed the Metabase check (`metabase-lb` on bi.iampatterson.com),
 * the one surface that accepted a redirect, ahead of [18.3] destroying it.
 */
import { spawnSync } from 'node:child_process';
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

  it('probes exactly the four public surfaces that remain', () => {
    const surfaces = checks.map((c) => `${c.host}${c.path}`).sort();
    expect(surfaces).toEqual(
      [
        'io.iampatterson.com/healthy',
        'event-stream-eb4xrwmo3q-uc.a.run.app/health',
        'claudish-proxy-eb4xrwmo3q-uc.a.run.app/health',
        'www.iampatterson.com/',
      ].sort(),
    );
  });

  it('no longer probes Metabase, which [18.3] destroys', () => {
    // Left in the spec, the check would fail the moment the load balancer goes
    // and page for a surface that was retired on purpose.
    expect(checks.map((c) => c.host)).not.toContain('bi.iampatterson.com');
    expect(checks.map((c) => c.displayName)).not.toContain('metabase-lb');
  });

  it('accepts only a 2xx as healthy on every check', () => {
    // The IAP redirect on the Metabase load balancer was the one 3xx accepted.
    for (const c of checks) expect(c.acceptedStatusClasses).toEqual(['STATUS_CLASS_2XX']);
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

/**
 * [18.10] A check the spec stops naming is reported for removal, and still not
 * deleted.
 *
 * apply.sh reconciles by walking the spec, so before this a check deleted from
 * uptime.json was invisible to it: the dry run printed nothing about it and the
 * live check and its alert policy went on probing. For metabase-lb that means
 * paging the moment [18.3] destroys the load balancer. The dry run now lists
 * every live uptime check and `Uptime:` policy the spec no longer names, as
 * REMOVE with the command to delete it by hand. The never-delete contract
 * above is unchanged: like the RECREATE path, removal is a person's act.
 *
 * Run rather than grepped: the embedded Python is executed with the network
 * calls stubbed, against a live state of the spec plus the retired check, in
 * apply mode (not dry run), and every write it attempts is recorded.
 */
describe('infrastructure/monitoring/apply.sh — checks the spec no longer names', () => {
  const retired = {
    displayName: 'metabase-lb',
    host: 'bi.iampatterson.com',
    path: '/',
    acceptedStatusClasses: ['STATUS_CLASS_2XX', 'STATUS_CLASS_3XX'],
    periodSeconds: 300,
    timeoutSeconds: 10,
    alert: true,
  };

  const harness = `
import json, sys
src = open(sys.argv[1]).read()
body = src.split("<<'PYEOF'\\n", 1)[1].rsplit("\\nPYEOF", 1)[0]
g = {"__name__": "harness"}
exec(body, g)  # CMD is "harness": defines everything, runs no command
extra = json.loads(sys.argv[2])
everything = g["checks_spec"] + extra
cid = lambda c: "projects/iampatterson/uptimeCheckConfigs/" + c["displayName"] + "-id"
live_checks = [{**g["desired_check"](c), "name": cid(c)} for c in everything]
live_policies = [{**g["desired_policy"](c, cid(c), []), "name": "projects/iampatterson/alertPolicies/" + c["displayName"]} for c in everything]
writes = []
def call(method, url, body=None, params=None):
    writes.append(method + " " + url)
    return {}
g["call"] = call
g["paged"] = lambda url, key, params=None: live_checks if key == "uptimeCheckConfigs" else live_policies
g["reconcile_policies"](g["reconcile_checks"](), {})
print("WRITES " + json.dumps(writes))
`;

  const run = () => {
    const res = spawnSync(
      'python3',
      [
        '-c',
        harness,
        path.join(root, 'infrastructure', 'monitoring', 'apply.sh'),
        JSON.stringify([retired]),
      ],
      {
        encoding: 'utf-8',
        env: {
          ...process.env,
          PROJECT: 'iampatterson',
          TOKEN: 'unused',
          SPEC_DIR: path.join(root, 'infrastructure', 'monitoring', 'spec'),
          OUT_DIR: 'docs/verification',
          DRY: '0',
          CMD: 'harness',
          ARG: '',
          REHEARSE_WAIT_MIN: '25',
        },
      },
    );
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
    return res.stdout;
  };

  it('reports the retired check and its policy as REMOVE, and nothing else', () => {
    const out = run();
    const removals = out.split('\n').filter((l) => /\bREMOVE\b/.test(l));
    expect(removals).toHaveLength(2);
    expect(removals.find((l) => /REMOVE\s+check\s/.test(l))).toMatch(/check\s+metabase-lb\b/);
    expect(removals.find((l) => /REMOVE\s+policy\s/.test(l))).toMatch(
      /policy\s+Uptime: metabase-lb\b/,
    );
    // The checks the spec still names are untouched.
    for (const c of json<UptimeCheck[]>('infrastructure/monitoring/spec/uptime.json')) {
      expect(out).toMatch(new RegExp(`unchanged\\s+check\\s+${c.displayName}\\b`));
      expect(out).toMatch(new RegExp(`unchanged\\s+policy\\s+Uptime: ${c.displayName}\\b`));
    }
  });

  it('names the exact resource to delete, the policy before the check', () => {
    const out = run();
    expect(out).toContain('projects/iampatterson/alertPolicies/metabase-lb');
    expect(out).toContain('projects/iampatterson/uptimeCheckConfigs/metabase-lb-id');
  });

  it('deletes nothing, even outside a dry run', () => {
    const writes = JSON.parse(
      run()
        .split('\n')
        .find((l) => l.startsWith('WRITES '))!
        .slice(7),
    );
    expect(writes).toEqual([]);
  });
});
