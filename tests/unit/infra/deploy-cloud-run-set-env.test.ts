/**
 * `set-env` and `kill-switch`, executed against a stubbed gcloud (2026-11-15).
 *
 * The bug these guard: `promote` pins traffic to a named revision, so the old
 * kill switch (`gcloud run services update --update-env-vars KILL_SWITCH=on`)
 * created a revision that served 0% and never stopped spending. The fix must
 * (1) build on the serving image, not whatever the service template holds,
 * (2) refuse to promote when anything but the requested env moved, and
 * (3) end with the new revision serving, checked by name and by value.
 * The stub keeps the serving revision in a file so (3) is a real check.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const repoRoot = path.join(__dirname, '..', '..', '..');
const scriptPath = path.join(repoRoot, 'scripts', 'deploy-cloud-run.sh');

const BEFORE = 'svc-00001-aaa';
/** set-env names its revision `<service>-env-<MMDDhhmmss>`. */
const AFTER = /^svc-env-\d{10}$/;
const A = 'a'.repeat(64);

type Mode = 'clean' | 'drift' | 'digest' | 'snapfail' | 'unpinned' | 'stuck' | 'dropenv';

/**
 * A Python gcloud. It keeps state like the real one, where it matters:
 * - the serving revision (moved only by update-traffic, unless MODE=stuck);
 * - the service template's env (KILL_SWITCH=off, LANES=TEMPLATE_LANES), which
 *   after a rollback differs from the serving revision's env;
 * - the new revision's env = template env + the deploy's --update-env-vars
 *   - its --remove-env-vars, as `gcloud run deploy` does. So a test proves the
 *   requested value reached the revision, not just that the flag was passed.
 * MODE: clean; drift (the template also moved maxScale); digest (the new
 * revision runs another image); snapfail (it can't be described); unpinned
 * (the serving image has no digest); stuck (traffic never moves); dropenv
 * (the deploy's env flags don't land on the revision).
 */
const STUB = `#!/usr/bin/env python3
import json, os, re, sys
args = " ".join(sys.argv[1:]); st = os.environ["STATE"]; mode = os.environ.get("MODE", "clean")
open(f"{st}/calls", "a").write(args + "\\n")
A, B = "a" * 64, "b" * 64
def rev(digest, env, max_scale="3"):
    return json.dumps({"metadata": {"annotations": {"autoscaling.knative.dev/minScale": "1",
        "autoscaling.knative.dev/maxScale": max_scale, "run.googleapis.com/execution-environment": "gen2"}},
        "spec": {"serviceAccountName": "svc@iampatterson.iam.gserviceaccount.com", "containerConcurrency": 80,
        "timeoutSeconds": 60, "containers": [{"image": f"us-docker.pkg.dev/iampatterson/svc@sha256:{digest}",
        "env": [{"name": k, "value": v} for k, v in env.items()],
        "resources": {"limits": {"cpu": "1", "memory": "512Mi"}}}]}})
serving_env = {"KILL_SWITCH": os.environ.get("SERVING_KILL_SWITCH", "off"), "LANES": "anthropic-api,cache-only"}
template_env = {"KILL_SWITCH": "off", "LANES": os.environ.get("TEMPLATE_LANES", "anthropic-api,cache-only")}
serving = open(f"{st}/serving").read().strip()
if "services describe" in args and "format=json" in args:
    print(json.dumps({"status": {"traffic": [{"percent": 100, "revisionName": serving}]},
        "spec": {"template": {"spec": {"containers": [{"env": [{"name": k, "value": v} for k, v in template_env.items()]}]}}}}))
elif "services describe" in args and "status.url" in args:
    print("https://svc.example")
elif "revisions describe" in args and "spec.containers[0].image" in args:
    print("us-docker.pkg.dev/iampatterson/svc:latest" if mode == "unpinned" else f"us-docker.pkg.dev/iampatterson/svc@sha256:{A}")
elif "revisions describe" in args and "${BEFORE}" in args:
    print(rev(A, serving_env))
elif "revisions describe" in args and "svc-env-" in args:
    if mode == "snapfail": sys.stderr.write("boom\\n"); sys.exit(1)
    env = json.load(open(f"{st}/after_env"))
    print(rev(B if mode == "digest" else A, env, "5" if mode == "drift" else "3"))
elif "run deploy" in args:
    env = dict(template_env)
    m = re.search(r"--update-env-vars=\\^@\\^(\\S*)", args)
    if m and mode != "dropenv": env.update(kv.split("=", 1) for kv in m.group(1).split("@") if kv)
    m = re.search(r"--remove-env-vars=(\\S+)", args)
    if m: [env.pop(k, None) for k in m.group(1).split(",")]
    json.dump(env, open(f"{st}/after_env", "w"))
elif "update-traffic" in args:
    if mode != "stuck":
        open(f"{st}/serving", "w").write(re.search(r"--to-revisions=(\\S+)=100", args).group(1))
    print("traffic moved")
elif "print-identity-token" in args:
    print("token")
`;

interface Run {
  status: number;
  out: string;
  calls: string[];
  serving: string;
}

function run(mode: Mode, args: string[], extraEnv: Record<string, string> = {}): Run {
  const dir = mkdtempSync(path.join(tmpdir(), 'set-env-harness-'));
  const bin = path.join(dir, 'bin');
  const state = path.join(dir, 'state');
  mkdirSync(bin);
  mkdirSync(state);
  writeFileSync(path.join(state, 'serving'), `${BEFORE}\n`);
  writeFileSync(path.join(state, 'calls'), '');
  for (const name of ['gcloud', 'curl']) {
    const file = path.join(bin, name);
    writeFileSync(file, name === 'gcloud' ? STUB : '#!/bin/bash\necho "${HEALTH:-200}"\n');
    chmodSync(file, 0o755);
  }
  let status = 0;
  let out = '';
  try {
    out = execFileSync('bash', [scriptPath, ...args], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        MODE: mode,
        STATE: state,
        DIFF_DIR: path.join(dir, 'diffs'),
        ...extraEnv,
      },
    });
  } catch (e) {
    const err = e as { status: number; stdout?: string; stderr?: string };
    status = err.status;
    out = `${err.stdout ?? ''}${err.stderr ?? ''}`;
  }
  return {
    status,
    out,
    calls: readFileSync(path.join(state, 'calls'), 'utf8').split('\n').filter(Boolean),
    serving: readFileSync(path.join(state, 'serving'), 'utf8').trim(),
  };
}

describe('kill-switch: the switch reaches traffic', () => {
  it('builds on the serving image digest, without traffic, changing only KILL_SWITCH', () => {
    const r = run('clean', ['kill-switch', 'svc', 'on']);
    const deploy = r.calls.find((c) => c.includes('run deploy'));
    expect(deploy).toBeDefined();
    // The serving digest, not the service template's image (which may be an unpromoted build).
    expect(deploy).toContain(`--image us-docker.pkg.dev/iampatterson/svc@sha256:${A}`);
    expect(deploy).toContain('--no-traffic');
    expect(deploy).toContain('--update-env-vars=^@^KILL_SWITCH=on');
    expect(deploy).toMatch(/--revision-suffix=env-\d{10}/);
    expect(deploy).not.toContain('--source');
  });

  it('ends with the new revision serving 100%, confirmed by name and value', () => {
    const r = run('clean', ['kill-switch', 'svc', 'on']);
    expect(r.status).toBe(0);
    expect(r.serving).toMatch(AFTER);
    expect(r.calls.some((c) => new RegExp(`--to-revisions=${r.serving}=100`).test(c))).toBe(true);
    expect(r.out).toContain(`✓ ${r.serving} serves 100% with KILL_SWITCH=on`);
  });

  it('turns a switch that is on off, and never routes traffic to LATEST', () => {
    const r = run('clean', ['kill-switch', 'svc', 'off'], { SERVING_KILL_SWITCH: 'on' });
    expect(r.status).toBe(0);
    expect(r.serving).toMatch(AFTER);
    expect(r.out).toContain('serves 100% with KILL_SWITCH=off');
    expect(r.calls.join('\n')).not.toMatch(/LATEST|--to-latest/);
  });

  it('refuses to promote when the template carried another change, and leaves traffic alone', () => {
    const r = run('drift', ['kill-switch', 'svc', 'on']);
    expect(r.status).toBe(2);
    expect(r.out).toContain('maxScale');
    expect(r.out).toContain('more changed than the requested env; not promoting');
    expect(r.serving).toBe(BEFORE);
  });

  it('refuses to promote when the image digest moved', () => {
    const r = run('digest', ['kill-switch', 'svc', 'on']);
    expect(r.status).toBe(2);
    expect(r.out).toContain('image digest moved');
    expect(r.serving).toBe(BEFORE);
  });

  it('never lets --allow-drift promote a revision on another image', () => {
    const r = run('digest', ['kill-switch', 'svc', 'on', '--allow-drift']);
    expect(r.status).toBe(2);
    expect(r.out).toContain('--allow-drift does not apply');
    expect(r.serving).toBe(BEFORE);
  });

  it('a requested key that is new lands on the revision and serves', () => {
    const r = run('clean', ['set-env', 'svc', 'NEW_KEY=x', '--promote']);
    expect(r.status).toBe(0);
    expect(r.out).toContain('serves 100% with NEW_KEY=x');
  });

  it('promotes drift only with --allow-drift', () => {
    const r = run('drift', ['kill-switch', 'svc', 'on', '--allow-drift']);
    expect(r.status).toBe(0);
    expect(r.serving).toMatch(AFTER);
  });

  it('refuses when the new revision cannot be described, whatever --allow-drift says', () => {
    const r = run('snapfail', ['kill-switch', 'svc', 'on', '--allow-drift']);
    expect(r.status).toBe(2);
    expect(r.out).toContain('could not snapshot');
    expect(r.serving).toBe(BEFORE);
  });

  it('refuses to build on a serving revision with no pinned digest', () => {
    const r = run('unpinned', ['kill-switch', 'svc', 'on']);
    expect(r.status).toBe(1);
    expect(r.out).toContain('no pinned image digest');
    expect(r.calls.some((c) => c.includes('run deploy'))).toBe(false);
  });

  it('fails loudly when traffic did not actually move', () => {
    // The original failure mode: the command "succeeds" and nothing changes.
    const r = run('stuck', ['kill-switch', 'svc', 'on']);
    expect(r.status).toBe(3);
    expect(r.out).toMatch(new RegExp(`serving revision is ${BEFORE}, not svc-env-\\d{10}`));
  });

  it('takes only on or off', () => {
    const r = run('clean', ['kill-switch', 'svc', 'yes']);
    expect(r.status).toBe(1);
    expect(r.calls.some((c) => c.includes('run deploy'))).toBe(false);
  });
});

describe('kill-switch: the cases an incident brings', () => {
  it('after a rollback, rebases the template env onto what serves, so the switch is not refused as drift', () => {
    // After `promote <older revision>`, the template keeps the newer env. The new
    // revision must carry the SERVING env plus KILL_SWITCH, not the template's.
    const r = run('clean', ['kill-switch', 'svc', 'on'], {
      TEMPLATE_LANES: 'vertex-global,vertex-regional,anthropic-api,cache-only',
    });
    const deploy = r.calls.find((c) => c.includes('run deploy'))!;
    expect(deploy).toContain('LANES=anthropic-api,cache-only');
    expect(r.status).toBe(0);
    expect(r.serving).toMatch(AFTER);
  });

  it('when the health probe fails, still confirms what serves and never suggests routing back', () => {
    const r = run('clean', ['kill-switch', 'svc', 'on'], { HEALTH: '503' });
    expect(r.status).toBe(4);
    expect(r.serving).toMatch(AFTER);
    expect(r.out).toContain('serves 100% with KILL_SWITCH=on');
    expect(r.out).toContain('do not route back');
    expect(r.out).not.toContain('roll back with');
  });

  it('rejects any argument but --allow-drift', () => {
    const r = run('clean', ['kill-switch', 'svc', 'on', '--alow-drift']);
    expect(r.status).toBe(1);
    expect(r.calls.some((c) => c.includes('run deploy'))).toBe(false);
  });
});

describe('set-env: an env change that is reviewed before it serves', () => {
  it('stops before traffic without --promote and names the exact revision to promote', () => {
    const r = run('clean', ['set-env', 'svc', 'KILL_SWITCH=on']);
    expect(r.status).toBe(0);
    expect(r.serving).toBe(BEFORE);
    expect(r.out).toContain('Stopped before traffic.');
    expect(r.out).toMatch(/promote svc svc-env-\d{10}/);
    expect(r.out).toContain('0 unexpected change(s)');
  });

  it('flags a requested key that did not land at the requested value', () => {
    const r = run('dropenv', [
      'set-env',
      'svc',
      'LANES=vertex-global,anthropic-api,cache-only',
      '--promote',
    ]);
    // dropenv: the deploy's env flags don't land, so the revision keeps the old LANES.
    expect(r.status).toBe(2);
    expect(r.out).toContain("expected 'vertex-global,anthropic-api,cache-only'");
    expect(r.serving).toBe(BEFORE);
  });

  it('refuses to promote when a requested key is on neither revision', () => {
    const r = run('dropenv', ['set-env', 'svc', 'NEW_KEY=x', '--promote']);
    expect(r.status).toBe(2);
    expect(r.out).toContain("env.NEW_KEY: None -> None (expected 'x')");
    expect(r.serving).toBe(BEFORE);
  });

  it('rejects a value containing the @ delimiter and anything that is not KEY=VALUE', () => {
    expect(run('clean', ['set-env', 'svc', 'A=b@c']).status).toBe(1);
    expect(run('clean', ['set-env', 'svc', 'novalue']).status).toBe(1);
    expect(run('clean', ['set-env', 'svc']).status).toBe(1);
  });
});
