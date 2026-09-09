/**
 * No workflow may interpolate step output into a script body.
 *
 * Graduated from a note to a check (Phase 14, [14.3]). `infra-terraform.yml`
 * compiled `${{ steps.plan.outputs.stdout }}` directly into an
 * `actions/github-script` body until `004f7a3` removed it. A pull request
 * controls the `.tf` files, therefore controls the plan text, therefore
 * controlled the JavaScript that step executed — an expression-injection sink
 * holding a `pull-requests: write` token.
 *
 * `infra-reconcile.yml` reproduces the same shape with reconciler output, which
 * a pull request likewise controls through the container specs. The alignment
 * review flagged it as a recurring mechanical pattern that should become a
 * test rather than a comment. This is that test, and it covers every workflow
 * including ones not yet written.
 *
 * The rule: values reach a script through `env:`, where they are data. They
 * never reach it through `${{ }}`, where they are source code.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const WORKFLOWS = path.join(process.cwd(), '.github', 'workflows');
const files = readdirSync(WORKFLOWS)
  .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
  .sort();

/** The `script:` blocks of every actions/github-script step in a workflow. */
function scriptBodies(yaml: string): string[] {
  const bodies: string[] = [];
  const lines = yaml.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const m = /^(\s*)script:\s*\|/.exec(lines[i]);
    if (!m) continue;
    const indent = m[1].length;
    const body: string[] = [];
    for (let j = i + 1; j < lines.length; j += 1) {
      const line = lines[j];
      if (line.trim() !== '' && line.length - line.trimStart().length <= indent) break;
      body.push(line);
    }
    bodies.push(body.join('\n'));
  }
  return bodies;
}

describe('workflows do not compile untrusted values into script bodies', () => {
  it('finds workflows to check, so an empty directory is not a silent pass', () => {
    expect(files.length).toBeGreaterThanOrEqual(2);
    expect(files).toContain('infra-reconcile.yml');
    expect(files).toContain('infra-terraform.yml');
  });

  it.each(files)('%s interpolates no expression into a github-script body', (file) => {
    const yaml = readFileSync(path.join(WORKFLOWS, file), 'utf8');
    for (const body of scriptBodies(yaml)) {
      // Any ${{ }} inside a script body is the sink. steps.*.outputs.* is the
      // dangerous case in practice, but github.event.* (a PR title, a branch
      // name) is equally attacker-controlled, so the rule is categorical.
      expect(body).not.toMatch(/\$\{\{/);
    }
  });

  it('the reconciler workflow reads its diff from env and a file, not from an expression', () => {
    const yaml = readFileSync(path.join(WORKFLOWS, 'infra-reconcile.yml'), 'utf8');
    expect(yaml).toMatch(/DIFF_OUTCOME:\s*\$\{\{\s*steps\.dryrun\.outcome\s*\}\}/);
    const [body] = scriptBodies(yaml);
    expect(body).toContain('process.env.DIFF_OUTCOME');
  });
});

describe('the reconcile workflow refuses an unprotected environment', () => {
  const yaml = readFileSync(path.join(WORKFLOWS, 'infra-reconcile.yml'), 'utf8');

  it('checks infra-production has protection rules before applying', () => {
    // The comment on infra-terraform.yml's apply job asserted repo settings
    // required manual approval. Measured 2026-09-08: no such environment
    // existed, and GitHub creates a referenced-but-missing environment
    // implicitly and unprotected. A comment cannot verify an external fact.
    expect(yaml).toContain('environments/infra-production');
    expect(yaml).toMatch(/protection_rules \| length/);
    expect(yaml).toMatch(/exit 1/);
  });

  it('runs that check before the apply step, not after', () => {
    expect(yaml.indexOf('refuse an unprotected environment')).toBeLessThan(
      yaml.indexOf('reconcile apply'),
    );
  });

  it('applies to a named container, never the default', () => {
    // reconcile.js refuses a write without --container, but a workflow that
    // relied on that refusal rather than naming one would be one flag change
    // from applying the server spec.
    expect(yaml).toMatch(/reconcile\.js --container=web --apply/);
    expect(yaml).not.toMatch(/reconcile\.js --apply/);
  });

  it('publishes as a step after the apply, not folded into it', () => {
    expect(yaml.indexOf('reconcile apply')).toBeLessThan(yaml.indexOf('name: publish'));
  });

  it('names the tagmanager scopes, which cloud-platform does not cover', () => {
    // google-github-actions/auth mints a cloud-platform token by default. The
    // Tag Manager API is not covered by it, so the first CI run would fail
    // with ACCESS_TOKEN_SCOPE_INSUFFICIENT.
    expect(yaml).toContain('tagmanager.edit.containers');
    expect(yaml).toContain('tagmanager.publish');
    expect(yaml).toContain('access_token_scopes');
  });
});
