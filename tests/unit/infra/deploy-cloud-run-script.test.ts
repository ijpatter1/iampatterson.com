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

  it('diffs the new revision against the serving one before any traffic moves', () => {
    const deployAt = script.indexOf('--no-traffic');
    // The call sites, not the function definitions above them.
    const diffAt = script.lastIndexOf('diff_revisions "');
    const promoteAt = script.lastIndexOf('update-traffic');
    expect(diffAt).toBeGreaterThan(deployAt);
    expect(promoteAt).toBeGreaterThan(diffAt);
  });

  it('moves traffic only behind the --promote flag, to the latest revision', () => {
    expect(script).toContain('--promote');
    expect(script).toMatch(/update-traffic[^\n]*--to-latest/);
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
});
