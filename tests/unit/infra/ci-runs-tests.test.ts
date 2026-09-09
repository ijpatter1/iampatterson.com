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
}
interface Job {
  if?: string | boolean;
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
  return Object.entries(w.doc.jobs ?? {}).filter(([, job]) => job?.if === undefined);
}

/** A matrix dimension's values, with `exclude:` entries removed. */
function effectiveMatrix(job: Job, key: string): string[] {
  const matrix = job.strategy?.matrix ?? {};
  const values = (matrix[key] as string[] | undefined) ?? [];
  const excluded = ((matrix.exclude as Record<string, string>[] | undefined) ?? [])
    .map((e) => e?.[key])
    .filter(Boolean);
  return values.filter((v) => !excluded.includes(v));
}

/** Every `run:` command in a job's steps. */
const commands = (job: Job): string[] =>
  (job.steps ?? []).map((s) => s?.run ?? '').filter((c) => c.length > 0);

const RUNS_JEST = /\b(npm (run )?test|npx jest|jest\b)/;

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

  it.each(['lint', 'build'])('a reachable job runs npm run %s', (script) => {
    const found = gating.some((w) =>
      reachableJobs(w).some(([, job]) =>
        commands(job).some((c) => new RegExp(`npm run ${script}\\b`).test(c)),
      ),
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
      expect(String(cancel)).not.toBe('true');
    }
  });
});
