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
  /**
   * Every alert row in the index, as { alert, targets }. Parsed rather than
   * substring-matched: an earlier version asserted the index merely *contained*
   * each alert's name and, separately, that linked files existed — so a row
   * carrying an alert name and no link at all satisfied both. That is exactly
   * the defect the boundary review found in 13.5's original wording, reproduced
   * in the test written to prevent it.
   */
  const alertRows = (): { alert: string; targets: string[] }[] =>
    index
      .split('\n')
      .filter((l) => /^\|/.test(l) && !/^\|\s*(Alert|Situation|---)/.test(l))
      .map((l) => {
        const cells = l.split('|').map((c) => c.trim());
        return {
          alert: cells[1] ?? '',
          targets: [...(cells[2] ?? '').matchAll(/\]\(([a-z0-9-]+\.md)\)/g)].map((m) => m[1]),
        };
      })
      .filter((r) => r.alert);

  it('every alert row resolves to at least one entry that exists', () => {
    const rows = alertRows();
    expect(rows.length).toBeGreaterThanOrEqual(16);
    for (const r of rows) {
      expect(r.targets.length).toBeGreaterThan(0);
      for (const t of r.targets) {
        expect(existsSync(path.join(root, RUNBOOK, t))).toBe(true);
      }
    }
  });

  it('covers all sixteen alerts: eleven policies plus one per uptime check', () => {
    expect(policies).toHaveLength(11);
    expect(checks).toHaveLength(5);
    // Backticks are markdown formatting, not wording, so normalise them away —
    // but compare the whole display name, because a prefix match is how the
    // previous version let a row drift from what the alert email says.
    const strip = (t: string) => t.replace(/`/g, '');
    const rowText = alertRows().map((r) => strip(r.alert)).join('\n');
    for (const p of policies) {
      expect(rowText).toContain(strip(p.displayName.split('(')[0].trim()));
    }
    for (const c of checks) {
      expect(rowText).toContain(c.displayName);
    }
  });

  it('routes the two service-agnostic alerts to more than one entry', () => {
    // Both fire on any service. The abort alert has fired unprompted here, on
    // data-generator — an operator sent only to the sGTM entry reads a Fix
    // section about raising sGTM's ceiling.
    for (const needle of ['5xx', 'no available instance']) {
      const row = alertRows().find((r) => r.alert.includes(needle));
      expect(row).toBeDefined();
      expect(row!.targets.length).toBeGreaterThan(1);
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

  it.each(allEntries)('%s passes the project flag on INLINE gcloud commands too', (_f, body) => {
    // The fenced-block check below missed these: a reader copies an inline
    // `gcloud …` out of prose just as readily, and the CLI default on this
    // machine is a different project, so it either fails confusingly or acts on
    // the wrong one. Found by review 2026-09-08 — the lint had a shape-shaped
    // hole rather than a coverage gap.
    // Markdown wraps inline code across lines, so collapse whitespace first —
    // otherwise a wrapped command reads as containing a newline and no pattern
    // matches it.
    const inline = [...body.matchAll(/`(gcloud [^`]*)`/g)].map((m) =>
      m[1].replace(/\s+/g, ' ').trim(),
    );
    for (const cmd of inline) {
      if (!/^gcloud (run|logging|pubsub|compute|scheduler|iam|billing|services) /.test(cmd)) continue;
      // Prose that names a command shape rather than inviting a copy is exempt,
      // and reads as "any gcloud run services update".
      if (/^gcloud \w+ \w+ \w+$/.test(cmd.trim())) continue;
      expect(cmd).toMatch(/--(project|billing-project)=iampatterson/);
    }
  });

  it.each(allEntries)('%s uses date flags that work on Linux as well as macOS', (_f, body) => {
    // BSD `date -v` does not exist in GNU coreutils, and this project ships a
    // Linux Docker sandbox. A bare -v breaks the diagnostic it belongs to.
    const bsdOnly = [...body.matchAll(/date -[uU]? *-v[-+]\d+[A-Za-z]/g)];
    for (const m of bsdOnly) {
      const around = body.slice(Math.max(0, m.index! - 20), m.index! + 220);
      // Acceptable only with a GNU fallback on the same command.
      expect(around).toContain("date -u -d '");
    }
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

