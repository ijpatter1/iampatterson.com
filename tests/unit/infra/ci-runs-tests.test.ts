/**
 * Some workflow must actually run the tests — and the job that runs them must
 * actually be reachable.
 *
 * Measured 2026-09-09: none did. `jest.config.js` roots are `tests/` and
 * `src/`; the three Cloud Run services carry their own `jest.config.json`;
 * nothing in `.github/workflows/` invoked either, and the three existing
 * workflows are path-scoped to Terraform, the GTM reconciler and the dataform
 * mirror. Of the eleven open Dependabot PRs, the four riskiest reported green
 * and the two safest red, because a "pass" mostly meant Vercel had built the
 * Next.js site, which does not import the changed package.
 *
 * **This file is on its third draft, and the first two were theatre.** They
 * matched strings anywhere in a workflow's raw text, so: deleting the root
 * job's jest step left them green (the services job's own `npm test` satisfied
 * the match); deleting the services job's jest step left them green (the
 * service names still appeared under `strategy.matrix`); `matrix.exclude`
 * left them green (excluded names are still values); dropping
 * `working-directory` so all three matrix jobs ran the root suite left them
 * green; and `if: false` on every job left them green. A platform review found
 * all five by running them.
 *
 * So the rule here is: resolve the JOB, check it is reachable, and read what
 * that job's steps actually run. Presence of a string in a file proves nothing,
 * which is the same lesson the workflow itself exists to teach.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import yaml from 'js-yaml';

const WORKFLOWS = path.join(process.cwd(), '.github', 'workflows');
const CLOUD_RUN = path.join(process.cwd(), 'infrastructure', 'cloud-run');

interface Step {
  run?: string;
  uses?: string;
  if?: string | boolean;
  'continue-on-error'?: boolean;
}
interface Job {
  if?: string | boolean;
  needs?: string | string[];
  strategy?: { matrix?: Record<string, unknown> };
  defaults?: { run?: { 'working-directory'?: string } };
  steps?: Step[];
}
interface WorkflowDoc {
  on?: Record<string, { paths?: string[]; 'paths-ignore'?: string[] } | null>;
  jobs?: Record<string, Job>;
}

const all = readdirSync(WORKFLOWS)
  .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
  .sort()
  .map((f) => ({
    file: f,
    body: readFileSync(path.join(WORKFLOWS, f), 'utf8'),
    doc: yaml.load(readFileSync(path.join(WORKFLOWS, f), 'utf8')) as WorkflowDoc,
  }));

/** Workflows that gate EVERY pull request. A `paths:` filter disqualifies. */
const gating = all.filter((w) => {
  const trigger = w.doc.on?.pull_request;
  if (trigger === undefined) return false;
  if (trigger === null) return true; // `pull_request:` with no body gates everything
  return !trigger.paths && !trigger['paths-ignore'];
});

/**
 * Jobs that will actually run. A conditional job cannot be relied on for
 * coverage — `if: false` disables it outright, and
 * `if: github.actor != 'dependabot[bot]'` would reopen the exact hole this
 * workflow closes. Neither is evaluable here, so any `if:` disqualifies.
 */
function reachableJobs(w: (typeof all)[number]): [string, Job][] {
  const jobs = w.doc.jobs ?? {};
  const unreachable = new Set<string>();
  for (const [id, job] of Object.entries(jobs)) if (job?.if !== undefined) unreachable.add(id);
  // GitHub skips a job whose dependency was skipped, so unreachability is
  // transitive through `needs:`. Without this, a `gate` job with `if: false`
  // plus `needs: gate` on both real jobs stops CI entirely while every check
  // here still reports coverage — verified as a surviving mutation.
  for (let changed = true; changed; ) {
    changed = false;
    for (const [id, job] of Object.entries(jobs)) {
      if (unreachable.has(id)) continue;
      const needs = typeof job?.needs === 'string' ? [job.needs] : (job?.needs ?? []);
      if (needs.some((n) => unreachable.has(n))) {
        unreachable.add(id);
        changed = true;
      }
    }
  }
  return Object.entries(jobs).filter(([id]) => !unreachable.has(id));
}

/** Jobs that run in the repo root — i.e. not the per-service matrix. */
const rootJobs = (w: (typeof all)[number]) =>
  reachableJobs(w).filter(
    ([, job]) => !(job.defaults?.run?.['working-directory'] ?? '').includes('cloud-run'),
  );

/** Jobs that run inside a Cloud Run service directory. */
const serviceJobs = (w: (typeof all)[number]) =>
  reachableJobs(w).filter(([, job]) =>
    (job.defaults?.run?.['working-directory'] ?? '').includes('cloud-run'),
  );

/** A matrix dimension's values, with `exclude:` entries removed. */
function effectiveMatrix(job: Job, key: string): string[] {
  const matrix = job.strategy?.matrix ?? {};
  const values = (matrix[key] as string[] | undefined) ?? [];
  const excluded = ((matrix.exclude as Record<string, string>[] | undefined) ?? [])
    .map((e) => e?.[key])
    .filter(Boolean);
  return values.filter((v) => !excluded.includes(v));
}

/**
 * Every `run:` command in a job's steps that can actually fail the job.
 *
 * A step carrying `if:` may not execute; `continue-on-error: true` cannot fail
 * the job; `|| true` swallows the exit code; `--listTests` enumerates without
 * running. Each of those left the 2,288-test root suite un-run or unable to
 * fail while every check here passed — the job-level `if:` defect one level
 * down, in a function whose docstring claimed to read what a job actually runs.
 */
const commands = (job: Job): string[] =>
  (job.steps ?? [])
    .filter((s) => s?.if === undefined && s?.['continue-on-error'] !== true)
    .map((s) => s?.run ?? '')
    .filter((c) => c.length > 0 && !/\|\|\s*true/.test(c) && !/--listTests/.test(c));

// Anchored to the start of a line, not merely contained. `run: echo skipping
// npm test` satisfied an unanchored match — a no-op step that mentions the
// command, which is the same "a string exists somewhere" defect this file has
// now been rewritten three times to remove. `/m` so multi-line `run: |` blocks
// are checked line by line.
const RUNS_JEST = /^\s*(npm (run )?test|npx jest|jest)\b/m;
const runsScript = (script: string) => new RegExp(`^\\s*npm run ${script}\\b`, 'm');

/** Service directories that carry their own jest config. */
const serviceDirs = readdirSync(CLOUD_RUN, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .filter((name) => {
    try {
      readFileSync(path.join(CLOUD_RUN, name, 'jest.config.json'));
      return true;
    } catch {
      return false;
    }
  })
  .sort();

describe('CI runs the tests', () => {
  it('finds workflows and services to check, so empty inputs are not a silent pass', () => {
    expect(all.length).toBeGreaterThanOrEqual(3);
    expect(gating.length).toBeGreaterThanOrEqual(1);
    expect(serviceDirs.length).toBeGreaterThanOrEqual(3);
  });

  it('a reachable job runs the ROOT suite, not merely some suite somewhere', () => {
    // Scoped to a job with no working-directory into a service: otherwise the
    // services matrix satisfies this and the 2,288-test root suite runs nowhere.
    const found = gating.some((w) =>
      reachableJobs(w).some(([, job]) => {
        const dir = job.defaults?.run?.['working-directory'] ?? '';
        if (dir.includes('cloud-run')) return false;
        return commands(job).some((c) => RUNS_JEST.test(c));
      }),
    );
    expect(found).toBe(true);
  });

  it.each(['lint', 'build'])('the ROOT job runs npm run %s', (script) => {
    // Scoped to the root job. Adding `npm run build` to the services matrix
    // took that string from one occurrence to two, after which this assertion
    // was satisfied by either job and the root build step — "the only thing
    // that catches a compile-level break", per its own comment — could be
    // deleted silently. That regression arrived in the commit that fixed the
    // identical defect on the root-suite check.
    const found = gating.some((w) =>
      rootJobs(w).some(([, job]) =>
        commands(job).some((c) => runsScript(script).test(c)),
      ),
    );
    expect(found).toBe(true);
  });

  it('the SERVICE jobs run npm run build, so files no test imports are typechecked', () => {
    // The mirror of the above: with one shared assertion, deleting the services
    // build step also passed, because the root job satisfied it.
    const found = gating.some((w) =>
      serviceJobs(w).some(([, job]) => commands(job).some((c) => runsScript('build').test(c))),
    );
    expect(found).toBe(true);
  });

  it.each(serviceDirs)('a reachable job runs the %s suite in its own directory', (service) => {
    // Three things together, because any one alone passed a mutation: the job
    // is reachable, the service survives `matrix.exclude`, and the job both
    // runs jest AND has a working-directory pointing into that service.
    const covered = gating.some((w) =>
      reachableJobs(w).some(([, job]) => {
        if (!commands(job).some((c) => RUNS_JEST.test(c))) return false;
        const dir = job.defaults?.run?.['working-directory'] ?? '';
        if (!dir.includes('cloud-run')) return false;
        // Either the directory names the service outright, or it interpolates a
        // matrix dimension whose effective values include it.
        if (dir.includes(service)) return true;
        const ref = /\$\{\{\s*matrix\.([A-Za-z0-9_]+)\s*\}\}/.exec(dir);
        return ref ? effectiveMatrix(job, ref[1]).includes(service) : false;
      }),
    );
    expect(covered).toBe(true);
  });

  it('the workflow also runs on pushes to main', () => {
    // `gating` keys on pull_request alone, so deleting the push trigger left
    // every check green — including the one below asserting a property of "a
    // merge to main", about a trigger that would no longer exist.
    const onMain = gating.some((w) => {
      const push = (w.doc.on as Record<string, { branches?: string[] }> | undefined)?.push;
      return push?.branches?.includes('main') ?? false;
    });
    expect(onMain).toBe(true);
  });

  it('the paid suites stay out of CI, quoted or not', () => {
    // GOLDEN_TEST and LATENCY_TEST bill per run against Vertex. The services
    // compare `=== '1'`, so the QUOTED form is the one that switches them on —
    // and an unquoted-only pattern missed exactly that.
    for (const w of all) {
      expect(w.body).not.toMatch(/GOLDEN_TEST\s*[:=]\s*['"]?1['"]?/);
      expect(w.body).not.toMatch(/LATENCY_TEST\s*[:=]\s*['"]?1['"]?/);
    }
  });

  it('a merge to main is never left with a cancelled, untested run', () => {
    // `cancel-in-progress: true` applied to pushes as well as PRs, so two
    // merges close together cancelled the first — leaving the commit that
    // landed on main with no run that ever tested it. The reason for cancelling
    // (Dependabot opening PRs in bursts) only concerns PR refs.
    for (const w of gating) {
      const cancel = (w.doc as { concurrency?: { 'cancel-in-progress'?: unknown } }).concurrency?.[
        'cancel-in-progress'
      ];
      if (cancel === undefined) continue;
      // Not a literal comparison. `${{ github.event_name != 'schedule' }}` and
      // `${{ true }}` both differ from the string "true" while cancelling
      // pushes exactly as before, and the value is already an expression — so
      // an edit is how the next change to this line will arrive.
      expect(String(cancel)).toMatch(/pull_request/);
    }
  });
});
