/**
 * Some workflow must actually run the tests.
 *
 * Measured 2026-09-09: none did. `jest.config.js` roots are `tests/` and
 * `src/`; the three Cloud Run services carry their own `jest.config.json`;
 * and nothing in `.github/workflows/` invoked `npm test`, `npx jest`, or
 * `docker build`. The three existing workflows are path-scoped to their own
 * concerns — Terraform, the GTM reconciler, the dataform mirror.
 *
 * The consequence was visible in the eleven open Dependabot PRs: the four
 * riskiest reported green and the two safest reported red, because a "pass"
 * mostly meant Vercel had built the Next.js site, which does not import the
 * changed package. `express` 4→5 across three services, `uuid` 9→14 into
 * CommonJS services, `@dataform/core` 2→3 and Node 24→26 all passed with
 * nothing having exercised them. Tailwind 3→4 failed only because it touches
 * the root `package.json`, so Vercel's build caught it by accident.
 *
 * Green has to mean something was checked, not that nothing looked.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import yaml from 'js-yaml';

const WORKFLOWS = path.join(process.cwd(), '.github', 'workflows');
const all = readdirSync(WORKFLOWS)
  .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
  .map((f) => ({ file: f, body: readFileSync(path.join(WORKFLOWS, f), 'utf8') }));

/** Workflows that run on pull requests — the ones a reviewer actually sees. */
const onPullRequest = all.filter((w) => /^on:[\s\S]*?pull_request:/m.test(w.body));

describe('CI runs the tests', () => {
  it('finds workflows to check, so an empty directory is not a silent pass', () => {
    expect(all.length).toBeGreaterThanOrEqual(3);
  });

  it('a pull-request workflow runs the root suite', () => {
    const runsRoot = onPullRequest.some((w) => /\b(npm (run )?test|npx jest)\b/.test(w.body));
    expect(runsRoot).toBe(true);
  });

  it.each(['claudish-proxy', 'data-generator', 'event-stream'])(
    'a pull-request workflow runs the %s service suite',
    (service) => {
      // Each service has its own jest.config.json and is invisible to the root
      // suite, whose roots are tests/ and src/ only.
      //
      // Parsed rather than grepped: the workflow covers these through a matrix,
      // so the service names live in `strategy.matrix`, not in a literal path.
      // A regex over the raw text would fail on a correct workflow — and, worse,
      // would pass for one that merely mentioned the directory in a comment.
      const covered = onPullRequest.some((w) => {
        const doc = yaml.load(w.body) as {
          jobs?: Record<string, { strategy?: { matrix?: Record<string, unknown> } }>;
        };
        return Object.values(doc.jobs ?? {}).some((job) => {
          const values = Object.values(job?.strategy?.matrix ?? {}).flat();
          return values.includes(service);
        });
      });
      expect(covered).toBe(true);
    },
  );

  it('every service directory is in the matrix, so a new one cannot be forgotten', () => {
    const dirs = readdirSync(path.join(process.cwd(), 'infrastructure', 'cloud-run'), {
      withFileTypes: true,
    })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    const inMatrix = onPullRequest.flatMap((w) => {
      const doc = yaml.load(w.body) as {
        jobs?: Record<string, { strategy?: { matrix?: Record<string, unknown> } }>;
      };
      return Object.values(doc.jobs ?? {}).flatMap((job) =>
        Object.values(job?.strategy?.matrix ?? {}).flat(),
      );
    });
    for (const dir of dirs) expect(inMatrix).toContain(dir);
  });

  it('a pull-request workflow runs the production build', () => {
    const builds = onPullRequest.some((w) => /\bnpm run build\b/.test(w.body));
    expect(builds).toBe(true);
  });

  it('the paid suites stay out of CI', () => {
    // GOLDEN_TEST and LATENCY_TEST spend real money per run against Vertex and
    // are deliberately an operator gate, not a per-PR check.
    for (const w of all) {
      expect(w.body).not.toMatch(/GOLDEN_TEST\s*[:=]\s*1/);
      expect(w.body).not.toMatch(/LATENCY_TEST\s*[:=]\s*1/);
    }
  });
});
