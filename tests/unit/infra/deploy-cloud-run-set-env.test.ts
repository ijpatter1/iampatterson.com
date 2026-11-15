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
const AFTER = 'svc-00002-bbb';
const A = 'a'.repeat(64);
const B = 'b'.repeat(64);

const revision = (digest: string, killSwitch: string, maxScale = '3') =>
  JSON.stringify({
    metadata: {
      annotations: {
        'autoscaling.knative.dev/minScale': '1',
        'autoscaling.knative.dev/maxScale': maxScale,
        'run.googleapis.com/execution-environment': 'gen2',
      },
    },
    spec: {
      serviceAccountName: 'svc@iampatterson.iam.gserviceaccount.com',
      containerConcurrency: 80,
      timeoutSeconds: 60,
      containers: [
        {
          image: `us-docker.pkg.dev/iampatterson/svc@sha256:${digest}`,
          env: [
            { name: 'KILL_SWITCH', value: killSwitch },
            { name: 'LANES', value: 'anthropic-api,cache-only' },
          ],
          resources: { limits: { cpu: '1', memory: '512Mi' } },
        },
      ],
    },
  });

type Mode = 'clean' | 'drift' | 'digest' | 'snapfail' | 'unpinned' | 'stuck';

/**
 * MODE: clean (only KILL_SWITCH moves), drift (the template also moved
 * maxScale), digest (the new revision runs another image), snapfail (the new
 * revision cannot be described), unpinned (the serving image has no digest),
 * stuck (update-traffic "succeeds" but traffic stays where it was).
 */
const STUB = `#!/bin/bash
set -u
ARGS="$*"
echo "$ARGS" >> "\${STATE}/calls"
case "$ARGS" in
  *"services describe"*"format=json"*)
    echo "{\\"status\\":{\\"traffic\\":[{\\"percent\\":100,\\"revisionName\\":\\"$(cat "\${STATE}/serving")\\"}]}}" ;;
  *"services describe"*latestCreatedRevisionName*) echo "${AFTER}" ;;
  *"services describe"*status.url*) echo "https://svc.example" ;;
  *"revisions describe"*"spec.containers[0].image"*)
    if [ "\${MODE}" = "unpinned" ]; then echo "us-docker.pkg.dev/iampatterson/svc:latest"
    else echo "us-docker.pkg.dev/iampatterson/svc@sha256:${A}"; fi ;;
  *"revisions describe"*"${BEFORE}"*) echo '${revision(A, 'off')}' ;;
  *"revisions describe"*"${AFTER}"*)
    case "\${MODE}" in
      snapfail) echo "boom" >&2; exit 1 ;;
      drift) echo '${revision(A, 'on', '5')}' ;;
      digest) echo '${revision(B, 'on')}' ;;
      *) echo '${revision(A, 'on')}' ;;
    esac ;;
  *"run deploy"*) : ;;
  *"update-traffic"*)
    if [ "\${MODE}" != "stuck" ]; then
      rev=$(echo "$ARGS" | sed -E 's/.*--to-revisions=([^= ]+)=100.*/\\1/'); echo "$rev" > "\${STATE}/serving"
    fi
    echo "traffic moved" ;;
  *"print-identity-token"*) echo "token" ;;
  *) : ;;
esac
`;

interface Run {
  status: number;
  out: string;
  calls: string[];
  serving: string;
}

function run(mode: Mode, args: string[]): Run {
  const dir = mkdtempSync(path.join(tmpdir(), 'set-env-harness-'));
  const bin = path.join(dir, 'bin');
  const state = path.join(dir, 'state');
  mkdirSync(bin);
  mkdirSync(state);
  writeFileSync(path.join(state, 'serving'), `${BEFORE}\n`);
  writeFileSync(path.join(state, 'calls'), '');
  for (const name of ['gcloud', 'curl']) {
    const file = path.join(bin, name);
    writeFileSync(file, name === 'gcloud' ? STUB : '#!/bin/bash\necho 200\n');
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
    expect(deploy).not.toContain('--source');
  });

  it('ends with the new revision serving 100%, confirmed by name and value', () => {
    const r = run('clean', ['kill-switch', 'svc', 'on']);
    expect(r.status).toBe(0);
    expect(r.serving).toBe(AFTER);
    expect(r.calls.some((c) => c.includes(`--to-revisions=${AFTER}=100`))).toBe(true);
    expect(r.out).toContain(`✓ ${AFTER} serves 100% with KILL_SWITCH=on`);
  });

  it('never routes traffic to LATEST', () => {
    const r = run('clean', ['kill-switch', 'svc', 'off']);
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

  it('promotes drift only with --allow-drift', () => {
    const r = run('drift', ['kill-switch', 'svc', 'on', '--allow-drift']);
    expect(r.status).toBe(0);
    expect(r.serving).toBe(AFTER);
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
    expect(r.out).toContain(`serving revision is ${BEFORE}, not ${AFTER}`);
  });

  it('takes only on or off', () => {
    const r = run('clean', ['kill-switch', 'svc', 'yes']);
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
    expect(r.out).toContain(`promote svc ${AFTER}`);
    expect(r.out).toContain('0 unexpected change(s)');
  });

  it('flags a requested key that did not land at the requested value', () => {
    const r = run('clean', [
      'set-env',
      'svc',
      'LANES=vertex-global,anthropic-api,cache-only',
      '--promote',
    ]);
    // The stub's new revision keeps the old LANES, so the requested change did not land.
    expect(r.status).toBe(2);
    expect(r.out).toContain("expected 'vertex-global,anthropic-api,cache-only'");
    expect(r.serving).toBe(BEFORE);
  });

  it('rejects a value containing the @ delimiter and anything that is not KEY=VALUE', () => {
    expect(run('clean', ['set-env', 'svc', 'A=b@c']).status).toBe(1);
    expect(run('clean', ['set-env', 'svc', 'novalue']).status).toBe(1);
    expect(run('clean', ['set-env', 'svc']).status).toBe(1);
  });
});
