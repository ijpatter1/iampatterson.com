/**
 * The deploy script, executed (Phase 12, deliverable 12.1).
 *
 * The sibling test pins the script's source text, which is how a regression
 * got through: a fix changed `if write_diff …; then` to `write_diff …; RC=$?`,
 * and under `set -euo pipefail` that aborts the script before any of the gates
 * it was guarding. Every source-text assertion still passed. These tests run
 * the script against a stubbed gcloud and assert exit codes and output, so a
 * gate that cannot be reached fails here.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const repoRoot = path.join(__dirname, '..', '..', '..');
const scriptPath = path.join(repoRoot, 'scripts', 'deploy-cloud-run.sh');

const BEFORE = 'svc-00001-aaa';
const AFTER = 'svc-00002-bbb';

/** A revision as `snapshot_revision` consumes it. `killSwitch` is the field the drift case moves. */
const revision = (digest: string, killSwitch: string) =>
  JSON.stringify({
    metadata: {
      annotations: {
        'autoscaling.knative.dev/minScale': '1',
        'autoscaling.knative.dev/maxScale': '3',
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
          env: [{ name: 'KILL_SWITCH', value: killSwitch }],
          resources: { limits: { cpu: '1', memory: '512Mi' } },
        },
      ],
    },
  });

/**
 * A gcloud that answers the calls the deploy path makes. MODE picks the
 * outcome: clean (only the digest moves), drift (an env var moves too), or
 * snapfail (the revision describe fails, so no diff can be computed).
 */
const STUB = `#!/bin/bash
set -u
ARGS="$*"
case "$ARGS" in
  *"services describe"*"format=json"*)
    echo '{"status":{"traffic":[{"percent":100,"revisionName":"${BEFORE}"}]}}' ;;
  *"services describe"*latestCreatedRevisionName*) echo "${AFTER}" ;;
  *"services describe"*status.url*) echo "https://svc.example" ;;
  *"revisions describe"*"${BEFORE}"*)
    echo '${revision('a'.repeat(64), 'off')}' ;;
  *"revisions describe"*"${AFTER}"*)
    if [ "\${MODE}" = "snapfail" ]; then echo "boom" >&2; exit 1; fi
    if [ "\${MODE}" = "drift" ]; then echo '${revision('b'.repeat(64), 'on')}'
    else echo '${revision('b'.repeat(64), 'off')}'; fi ;;
  *"run deploy"*) : ;;
  *"update-traffic"*) echo "traffic moved" ;;
  *"print-identity-token"*) echo "token" ;;
  *) : ;;
esac
`;

interface Run {
  status: number;
  out: string;
}

function runDeploy(mode: 'clean' | 'drift' | 'snapfail', extra: string[]): Run {
  const dir = mkdtempSync(path.join(tmpdir(), 'deploy-harness-'));
  const bin = path.join(dir, 'bin');
  mkdirSync(bin);
  for (const name of ['gcloud', 'curl']) {
    const file = path.join(bin, name);
    writeFileSync(file, name === 'gcloud' ? STUB : '#!/bin/bash\necho 200\n');
    chmodSync(file, 0o755);
  }
  try {
    const out = execFileSync('bash', [scriptPath, 'deploy', 'svc', 'src', ...extra], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        MODE: mode,
        DIFF_DIR: path.join(dir, 'diffs'),
      },
    });
    return { status: 0, out };
  } catch (e) {
    const err = e as { status: number; stdout?: string; stderr?: string };
    return { status: err.status, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

describe('scripts/deploy-cloud-run.sh, executed against a stubbed gcloud', () => {
  it('stops before traffic and names the promote command, even when fields drifted', () => {
    // The regression this file exists for: under errexit a drifting diff
    // aborted the script here, so the operator lost both the diff path and
    // the promote instruction and saw only a bare exit code.
    const r = runDeploy('drift', []);
    expect(r.status).toBe(0);
    expect(r.out).toContain('diff written:');
    expect(r.out).toContain('Stopped before traffic.');
    expect(r.out).toContain(`promote svc ${AFTER}`);
  });

  it('promotes when only the image digest changed', () => {
    const r = runDeploy('clean', ['--promote']);
    expect(r.status).toBe(0);
    expect(r.out).toContain('0 field(s) differ besides the digest');
    expect(r.out).toContain('promote: all traffic');
  });

  it('refuses to promote on real drift, and says how to proceed', () => {
    const r = runDeploy('drift', ['--promote']);
    expect(r.status).toBe(2);
    expect(r.out).toContain('fields other than the image digest differ; not promoting');
    expect(r.out).not.toContain('promote: all traffic');
  });

  it('promotes drift only when --allow-drift is passed', () => {
    const r = runDeploy('drift', ['--promote', '--allow-drift']);
    expect(r.status).toBe(0);
    expect(r.out).toContain('promote: all traffic');
  });

  it('refuses to promote when the snapshot failed, and --allow-drift does not override it', () => {
    // A failed snapshot is not "no drift": there is no diff to review, so the
    // flag has nothing to override. This is the distinction the gate exists for.
    const r = runDeploy('snapfail', ['--promote', '--allow-drift']);
    expect(r.status).toBe(2);
    expect(r.out).toContain('--allow-drift does not apply');
    expect(r.out).not.toContain('promote: all traffic');
  });
});
