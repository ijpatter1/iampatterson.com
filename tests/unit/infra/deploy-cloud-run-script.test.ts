/**
 * Cloud Run deploy script contract (Phase 12, deliverable 12.1).
 *
 * event-stream and data-generator had no deploy path in the repo; a bare
 * `gcloud run deploy --source` that dropped an env var or the scaling
 * annotations would take the live overlay down while /health still
 * answered. The script deploys with no traffic, diffs the new revision
 * against the serving one, and moves traffic only when asked.
 */
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const scriptPath = path.join(__dirname, '..', '..', '..', 'scripts', 'deploy-cloud-run.sh');
const script = readFileSync(scriptPath, 'utf8');

describe('scripts/deploy-cloud-run.sh', () => {
  it('is executable and fails fast', () => {
    expect(statSync(scriptPath).mode & 0o111).not.toBe(0);
    expect(script).toContain('set -euo pipefail');
  });

  it('deploys the new revision without traffic first', () => {
    expect(script).toMatch(/gcloud run deploy[^\n]*--no-traffic/);
  });

  it('exposes deploy, diff and promote so the reviewed revision is the promoted one', () => {
    for (const cmd of ['  deploy)', '  diff)', '  promote)']) expect(script).toContain(cmd);
    expect(script).toContain('--allow-drift');
    expect(script).toContain('not promoting');
  });

  it('refuses to promote when the drift snapshot itself failed, whatever --allow-drift says', () => {
    // write_diff returns 2 when a snapshot could not be taken and 1 on real
    // drift. The caller collapsed both into one flag, so --allow-drift — the
    // documented deploy path — promoted a revision whose diff had never been
    // computed, which is the one thing the gate exists to prevent.
    expect(script).toContain('DIFF_RC=$?');
    const gate = script.slice(script.indexOf('DIFF_RC=$?'), script.indexOf('promote: all traffic'));
    expect(gate).toContain('[ "$DIFF_RC" = "2" ]');
    expect(gate).toContain('--allow-drift does not apply');
    expect(gate.indexOf('"$DIFF_RC" = "2"')).toBeLessThan(gate.indexOf('ALLOW_DRIFT'));
  });

  it('writes every diff under docs/verification/deploys so the record can cite it', () => {
    expect(script).toContain('docs/verification/deploys');
  });

  it('diffs the new revision against the serving one before any traffic moves', () => {
    // Inside the deploy case: build (no traffic), then the diff call, then promotion.
    const deployCase = script.slice(script.indexOf('  deploy)'));
    const deployAt = deployCase.indexOf('--no-traffic');
    const diffAt = deployCase.indexOf('write_diff "$SERVICE"');
    const promoteAt = deployCase.indexOf('update-traffic');
    expect(diffAt).toBeGreaterThan(deployAt);
    expect(promoteAt).toBeGreaterThan(diffAt);
  });

  it('moves traffic only behind the --promote flag, to the latest revision', () => {
    expect(script).toContain('--promote');
    // Promotion names the exact revision that was diffed, never "latest".
    expect(script).toMatch(/update-traffic[^\n]*--to-revisions="?\$(AFTER|REV)=100/);
    expect(script).not.toContain('--to-latest');
  });

  it('never rewrites the service env (the live values are the contract)', () => {
    expect(script).not.toContain('--set-env-vars');
    expect(script).not.toContain('--update-env-vars');
  });

  it('names the project on every gcloud call', () => {
    const calls = script.split('\n').filter((l) => /\bgcloud\s+run\b/.test(l) && !l.trim().startsWith('#'));
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) expect(call).toContain('--project');
  });

  it('probes a private service with an identity token when the anonymous probe is refused', () => {
    // data-generator only admits the scheduler account; an anonymous 403 must
    // not read as a failed deploy (review finding, 2026-09-04).
    expect(script).toContain('print-identity-token');
    expect(script).toMatch(/403/);
  });

  it('counts the image digest as the expected change, not as drift', () => {
    expect(script).toContain('imageDigest');
    expect(script).toContain('besides the digest');
  });

  it('treats a failed snapshot as a failure, never as no drift, and asserts the positive verdict', () => {
    expect(script).toContain('could not snapshot');
    expect(script).toMatch(/grep -qE "\^ \*0 field/);
  });

  it('renders secret env by name, key and version so a repointed secret shows as drift', () => {
    expect(script).toContain('<secret:%s/%s@%s>');
  });

  it('keeps set -e from killing the health probe before the roll-back line prints', () => {
    const probes = script.split('\n').filter((l) => l.includes("-w '%{http_code}'"));
    expect(probes.length).toBeGreaterThan(0);
    for (const probe of probes) expect(probe).toContain('|| true');
  });
});
