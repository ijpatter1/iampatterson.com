/**
 * The operational runbook (Phase 13, 13.5).
 *
 * 13.5's acceptance is mechanical enough to test: every one of the sixteen
 * Phase 12 alerts links to an entry, every entry carries a rehearsal record or
 * a written reason it cannot be rehearsed, and the manual task card exists.
 *
 * The prose quality is not testable and is not tested. What is tested is that
 * no alert points into nothing, which is the failure the boundary review found
 * in 13.5's original wording.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');
const RUNBOOK = 'docs/runbook';

const index = read(`${RUNBOOK}/README.md`);
const entryFiles = readdirSync(path.join(root, RUNBOOK)).filter(
  (f) => f.endsWith('.md') && f !== 'README.md',
);

interface Policy {
  displayName: string;
  runbook?: string;
}
const policies = JSON.parse(read('infrastructure/monitoring/spec/policies.json')) as Policy[];
const checks = JSON.parse(read('infrastructure/monitoring/spec/uptime.json')) as {
  displayName: string;
}[];

/** Every markdown link target in the index, as a filename. */
const linked = [...index.matchAll(/\]\(([a-z0-9-]+\.md)\)/g)].map((m) => m[1]);

describe('13.5 — every alert leads somewhere', () => {
  it('the index covers all sixteen alerts: eleven policies plus one per uptime check', () => {
    expect(policies).toHaveLength(11);
    expect(checks).toHaveLength(5);
    // Each policy's displayName should be recognisable in the index's table.
    for (const p of policies) {
      const head = p.displayName.split(':')[0].slice(0, 34);
      expect(index).toContain(head);
    }
    for (const c of checks) {
      expect(index).toContain(c.displayName);
    }
  });

  it('every entry the index links to actually exists', () => {
    expect(linked.length).toBeGreaterThan(10);
    for (const f of linked) {
      expect(existsSync(path.join(root, RUNBOOK, f))).toBe(true);
    }
  });

  it('every entry file is reachable from the index', () => {
    // An orphan entry is as much a defect as a broken link: nobody arrives at it.
    for (const f of entryFiles) {
      expect(linked).toContain(f);
    }
  });

  it('covers each failure mode the deliverable names', () => {
    for (const f of [
      'sgtm-not-responding.md',
      'event-pipeline-backlog.md',
      'dataform-assertion-failure.md',
      'data-generator-stuck.md',
      'revision-will-not-start.md',
      'uptime-check-failing.md',
      'bigquery-spend.md',
      'certificate-renewal-failure.md',
      'claudish-proxy-over-budget.md',
      'vercel-build-failing.md',
      'expired-gcloud-credentials.md',
      'preview-protection.md',
    ]) {
      expect(entryFiles).toContain(f);
    }
  });
});

/** Entries that describe an incident. The two maintenance pages — the image
 *  update and the dependency cadence — are scheduled work, not failure modes,
 *  and do not carry a rehearsal or an incident-shaped verification section. */
const FAILURE_MODES = entryFiles.filter(
  (f) => !['sgtm-image-update.md', 'dependency-cadence.md'].includes(f),
);

describe('13.5 — every entry is usable by someone who has never seen the stack', () => {
  const entries = FAILURE_MODES.map((f) => [f, read(`${RUNBOOK}/${f}`)] as const);
  const allEntries = entryFiles.map((f) => [f, read(`${RUNBOOK}/${f}`)] as const);

  it.each(entries)('%s says how you know it worked', (_f, body) => {
    // The commonest runbook defect: it tells you what to type and not how to
    // tell whether it helped.
    expect(body).toMatch(/## How you know it worked/i);
  });

  it.each(entries)('%s carries a rehearsal record or a written reason', (_f, body) => {
    expect(body).toMatch(/## Rehearsal/i);
    const rehearsal = body.slice(body.search(/## Rehearsal/i));
    // Either a dated rehearsal, or an explicit statement that it cannot be done.
    const dated = /\d{4}-\d{2}-\d{2}/.test(rehearsal);
    const reasoned = /not rehearsed|cannot|deliberately not/i.test(rehearsal);
    expect(dated || reasoned).toBe(true);
  });

  it.each(allEntries)('%s has no unfilled rehearsal placeholder', (_f, body) => {
    expect(body).not.toContain('REHEARSAL_PLACEHOLDER');
  });

  it.each(allEntries)('%s passes the project flag on gcloud commands', (_f, body) => {
    // The CLI default on this machine is a different project, so a command that
    // omits the flag either fails confusingly or operates on the wrong project.
    // Checked per fenced code block rather than per line: commands here wrap
    // across lines both with backslashes and inside quoted log filters, so a
    // line-based check reports false failures on correct commands.
    const blocks = [...body.matchAll(/```bash\n([\s\S]*?)```/g)].map((m) => m[1]);
    for (const block of blocks) {
      // `gcloud auth` is account-scoped; `gcloud config` reads local state.
      const usesProjectScoped = /gcloud (run|logging|pubsub|compute|scheduler|iam|billing|services) /.test(
        block,
      );
      if (usesProjectScoped) {
        expect(block).toContain('--project=iampatterson');
      }
    }
  });
});

describe('13.5 — the manual task card', () => {
  it('exists for the Vercel automation bypass secret', () => {
    const card = read('docs/manual/task-2026-09-05-001.md');
    expect(card).toMatch(/\*\*Status:\*\*/);
    expect(card).toContain('VERCEL_AUTOMATION_BYPASS_SECRET');
    // The card must say why it cannot be scripted, or it is not a manual task.
    expect(card).toMatch(/browser action/i);
  });
});
