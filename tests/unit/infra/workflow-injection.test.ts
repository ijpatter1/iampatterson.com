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

  it('the reconciler workflow reads its diff from a file and its outcome from env', () => {
    const yaml = readFileSync(path.join(WORKFLOWS, 'infra-reconcile.yml'), 'utf8');
    expect(yaml).toMatch(/DIFF_OUTCOME:\s*\$\{\{\s*steps\.dryrun\.outcome\s*\}\}/);
    const [body] = scriptBodies(yaml);
    expect(body).toContain('process.env.DIFF_OUTCOME');
    // The diff itself is the large, fully attacker-controlled half, and it
    // travels by file. Asserting only DIFF_OUTCOME let a reintroduced
    // `DIFF_STDOUT` env pass this test — which is how it read until the
    // alignment review pointed out the title promised more than the body.
    expect(body).toContain("readFileSync('/tmp/diff.txt'");
    expect(yaml).toMatch(/tee -a \/tmp\/diff\.txt/);
  });
});

describe('every job that applies to production refuses an unprotected environment', () => {
  // Scoped to one workflow, this check passed while infra-terraform.yml — the
  // job that runs `terraform apply -auto-approve` over the entire project —
  // carried no preflight at all, only the comment `# repo setting requires
  // manual approval` that was measured FALSE on 2026-09-08. [14.3] asks for the
  // guard on *each* apply job, so the check iterates instead of naming one file.
  const guarded = files
    .map((f) => [f, readFileSync(path.join(WORKFLOWS, f), 'utf8')] as const)
    .filter(([, y]) => /environment:\s*infra-production/.test(y));

  it('finds the workflows that deploy to infra-production', () => {
    expect(guarded.length).toBeGreaterThanOrEqual(2);
    expect(guarded.map(([f]) => f)).toEqual(
      expect.arrayContaining(['infra-reconcile.yml', 'infra-terraform.yml']),
    );
  });

  it.each(guarded.map(([f]) => f))('%s asserts protection rules before applying', (file) => {
    const y = readFileSync(path.join(WORKFLOWS, file), 'utf8');
    expect(y).toContain('environments/infra-production');
    expect(y).toMatch(/protection_rules \| length/);
    // The assertion must precede the step it guards. Anchor on the step's
    // `name:` — matching the bare command catches prose, and infra-reconcile.yml
    // discusses `terraform apply -auto-approve` in its prerequisites comment
    // eighty lines above its own guard.
    const guard = y.indexOf('protection_rules');
    const applyStep = y.search(/^\s+- name: (terraform apply|reconcile apply)/m);
    expect(guard).toBeGreaterThan(-1);
    expect(applyStep).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(applyStep);
  });

  it('no apply job asserts approval in a comment instead of checking it', () => {
    // A comment cannot verify an external fact. This exact comment sat on
    // infra-terraform.yml's apply job while no such environment existed.
    for (const [, y] of guarded) {
      expect(y).not.toMatch(/#\s*repo setting requires manual approval/);
    }
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

  it('pipes the dry run through a shell with pipefail, so tee cannot mask a crash', () => {
    // `node reconcile.js | tee -a /tmp/diff.txt` exits with tee's status,
    // which is always 0. Without pipefail a reconciler that throws leaves
    // steps.dryrun.outcome at "success": the PR comment drops its warning
    // banner and the "Fail if the dry run errored" gate never fires — the
    // two mechanisms that exist to catch exactly that.
    //
    // GitHub's default for `run:` on Linux is `bash -e {0}`, no pipefail.
    // Naming `shell: bash` switches it to `bash --noprofile --norc -eo
    // pipefail {0}`. The difference is invisible in the diff, which is why
    // it is pinned here rather than left to a comment.
    const dryRun = yaml.slice(yaml.indexOf('id: dryrun'), yaml.indexOf('name: post the diff'));
    expect(dryRun).toMatch(/tee -a/);
    expect(dryRun).toMatch(/shell: bash/);
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
