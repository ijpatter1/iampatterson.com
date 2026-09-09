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

/**
 * The top-level job blocks of a workflow, by name.
 *
 * Needed because a whole-file string index cannot tell which *job* a step lives
 * in. The guard-position check below compared indices across the entire file,
 * so moving the preflight out of `apply` and into `validate` — leaving
 * `terraform apply -auto-approve` with no guard at all — still passed. That is
 * the same regression class the guard was added to close.
 */
function jobBlocks(yaml: string): Record<string, string> {
  const lines = yaml.split('\n');
  const jobsAt = lines.findIndex((l) => /^jobs:\s*$/.test(l));
  if (jobsAt < 0) return {};
  const out: Record<string, string> = {};
  let name = '';
  let body: string[] = [];
  for (let i = jobsAt + 1; i < lines.length; i += 1) {
    const header = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(lines[i]);
    if (header) {
      if (name) out[name] = body.join('\n');
      name = header[1];
      body = [];
    } else if (name) {
      body.push(lines[i]);
    }
  }
  if (name) out[name] = body.join('\n');
  return out;
}

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
    // Scope to the job that actually deploys. A file-level search passes while
    // the guard sits in a sibling job that deploys nothing.
    const deploying = Object.entries(jobBlocks(y)).filter(([, b]) =>
      /environment:\s*infra-production/.test(b),
    );
    expect(deploying.length).toBeGreaterThan(0);

    for (const [jobName, body] of deploying) {
      // The guard must be IN this job, not merely somewhere in the file — and
      // must be the jq that RUNS, not the comment that explains it. The literal
      // `protection_rules | length` now appears only in that comment (the check
      // counts required_reviewers specifically), so matching it asserted prose:
      // deleting the whole `gh api` lookup and keeping the comment passed.
      expect(`${file}:${jobName} → ${body}`).toMatch(/select\(\.type\s*==\s*"required_reviewers"\)/);
      expect(body).toContain('environments/infra-production');

      // …and before the step it guards. Anchored on required_reviewers for the
      // same reason: `indexOf('protection_rules')` found the comment, so the
      // ordering check measured where the prose sat, not where the guard ran.
      const guard = body.indexOf('required_reviewers');
      const applyStep = body.search(/^\s+- name: (terraform apply|reconcile apply)/m);
      expect(applyStep).toBeGreaterThan(-1);
      expect(guard).toBeGreaterThan(-1);
      expect(guard).toBeLessThan(applyStep);
    }
  });

  it.each(guarded.map(([f]) => f))('%s checks for a REQUIRED REVIEWER, not any rule', (file) => {
    const y = readFileSync(path.join(WORKFLOWS, file), 'utf8');
    // `.protection_rules | length` counts wait timers and branch policies too.
    // An environment carrying only a wait timer reports 1, the guard prints a
    // reassuring count, and the apply proceeds unreviewed — the exact state
    // [14.3] exists to prevent, passing the check written to prevent it.
    expect(y).toMatch(/select\(\.type\s*==\s*"required_reviewers"\)/);
    expect(y).not.toMatch(/--jq '\.protection_rules \| length'/);
  });

  it.each(guarded.map(([f]) => f))('%s runs the guard as the FIRST step', (file) => {
    const y = readFileSync(path.join(WORKFLOWS, file), 'utf8');
    for (const [, body] of Object.entries(jobBlocks(y)).filter(([, b]) =>
      /environment:\s*infra-production/.test(b),
    )) {
      // The guard needs no working tree, so nothing — not even a checkout —
      // should happen before the environment is confirmed to require a human.
      const firstStep = /^\s+- (?:name|uses):\s*(.+)$/m.exec(body.slice(body.indexOf('steps:')));
      expect(firstStep?.[1]).toContain('refuse an unprotected environment');
    }
  });

  it('the guard is byte-identical across every workflow that carries it', () => {
    // Two hand-maintained copies diverged one commit after being unified: one
    // gained a 404-vs-unreadable distinction and the other kept collapsing them.
    // Presence and position checks cannot see that; equality can.
    const blocks = guarded.map(([, y]) => {
      const i = y.indexOf('- name: refuse an unprotected environment');
      const j = y.indexOf('\n      - ', i + 1);
      return y.slice(i, j === -1 ? undefined : j).trim();
    });
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    for (const b of blocks.slice(1)) expect(b).toEqual(blocks[0]);
  });

  it('no run: block compiles an untrusted expression into shell', () => {
    // A `run:` block interpolates ${{ }} into shell exactly as `script:`
    // interpolates it into JS. The original check looked only at script bodies,
    // so this category was open. github.repository and github.token are not
    // attacker-controlled; anything else reaching shell must come via env:.
    const TRUSTED = /^(github\.(repository|token|sha|ref|run_id)|env\.[A-Z_]+|vars\.[A-Z_]+|secrets\.[A-Z_]+|steps\.[a-z_]+\.outputs\.[a-z_]+)$/;
    for (const file of files) {
      const y = readFileSync(path.join(WORKFLOWS, file), 'utf8');
      const lines = y.split('\n');
      let inRun = false;
      let indent = 0;
      for (const line of lines) {
        const open = /^(\s*)run:\s*\|/.exec(line);
        if (open) {
          inRun = true;
          indent = open[1].length;
          continue;
        }
        if (inRun) {
          if (line.trim() !== '' && line.length - line.trimStart().length <= indent) inRun = false;
          else {
            for (const m of line.matchAll(/\$\{\{\s*([^}]+?)\s*\}\}/g)) {
              expect(`${file}: \${{ ${m[1]} }}`).toMatch(
                new RegExp(`\\$\\{\\{ (?:${TRUSTED.source.slice(1, -1)}) \\}\\}`),
              );
            }
          }
        }
      }
    }
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
    // The executable jq, not the comment that describes it — nothing else in
    // this block pinned the check, so prose plus a stray `exit 1` satisfied it.
    expect(yaml).toMatch(/select\(\.type\s*==\s*"required_reviewers"\)/);
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
    // Anchored to a real YAML key, not the prose. The unanchored form matched
    // the comment above the key that explains why the key is there, so deleting
    // the key left this green — the exact vacuity this file exists to prevent.
    expect(dryRun).toMatch(/^\s+shell: bash\s*$/m);
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
