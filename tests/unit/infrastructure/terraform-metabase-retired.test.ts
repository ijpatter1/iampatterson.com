/**
 * @jest-environment node
 *
 * [18.3] Metabase is retired from the Terraform root.
 *
 * Terraform step two. It depends on [18.10] having been merged and applied
 * first: until `terraform state show` reports `deletion_protection = false` on
 * the service and the app database instance, deleting the blocks here fails the
 * apply instead of destroying them. That precondition is a step in the control
 * plane's manual card, `docs/manual/task-2026-11-15-003.md`, and no test here
 * can check it. The plan on the pull request is the real proof and Ian approves
 * it at the `infra-production` gate; these pins hold the configuration to the
 * shape that plan depends on: no Metabase resource, import or grant left
 * behind, and the two Cloud SQL children forgotten rather than destroyed.
 */
import { parse } from '@cdktf/hcl2json';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TF_DIR = path.join(ROOT, 'infrastructure', 'terraform');
const tfFiles = readdirSync(TF_DIR).filter((f) => f.endsWith('.tf'));

/* eslint-disable @typescript-eslint/no-explicit-any */
let parsed: Record<string, any>;
/* eslint-enable @typescript-eslint/no-explicit-any */

beforeAll(async () => {
  parsed = {};
  for (const f of tfFiles) parsed[f] = await parse(f, readFileSync(path.join(TF_DIR, f), 'utf8'));
});

/** Every address the root declares, reads or imports into, as `type.name`. */
const declared = (): string[] => {
  const out: string[] = [];
  for (const json of Object.values(parsed)) {
    for (const [type, byName] of Object.entries(json.resource ?? {}))
      for (const name of Object.keys(byName as object)) out.push(`${type}.${name}`);
    for (const [type, byName] of Object.entries(json.data ?? {}))
      for (const name of Object.keys(byName as object)) out.push(`data.${type}.${name}`);
    for (const imp of json.import ?? []) out.push(`import ${imp.to} ${imp.id}`);
  }
  return out;
};

describe('[18.3] the Terraform root no longer declares Metabase', () => {
  it('reads the root, so an empty parse is not a silent pass', () => {
    expect(tfFiles.length).toBeGreaterThan(5);
    expect(declared()).toContain('google_cloud_run_v2_service.sgtm');
  });

  it('declares, reads and imports nothing named for Metabase', () => {
    expect(declared().filter((a) => /metabase/i.test(a))).toEqual([]);
  });

  it('keeps no Cloud SQL instance and no load balancer piece, which only Metabase used', () => {
    const offenders = declared().filter((a) =>
      /^(google_sql_|google_compute_|import \$\{google_(sql|compute)_)/.test(a),
    );
    expect(offenders).toEqual([]);
  });

  it('deletes the files that held them', () => {
    for (const f of ['metabase-lb.tf', 'cloud-sql.tf', 'imports-lb.tf', 'imports-sql.tf'])
      expect(tfFiles).not.toContain(f);
  });

  it('grants no project role to a Metabase identity and declares neither account', () => {
    const all = tfFiles
      .filter((f) => f !== 'removed-metabase.tf')
      .map((f) => readFileSync(path.join(TF_DIR, f), 'utf8'))
      .join('\n');
    expect(all).not.toMatch(/metabase-(runtime|bigquery)/);
    const accounts = parsed['service-accounts.tf'].locals[0].service_accounts;
    expect(Object.keys(accounts).filter((k) => k.startsWith('metabase'))).toEqual([]);
    const roles = parsed['iam.tf'].locals[0].runtime_project_roles;
    expect(Object.keys(roles).filter((k) => k.startsWith('metabase'))).toEqual([]);
  });
});

describe('[18.3] the database and its user go with the instance, not before it', () => {
  // Destroying them as resources races the rest of the plan. Nothing orders
  // them after the metabase service, so the database delete can run while
  // Metabase still holds connections, which Postgres refuses; and Postgres
  // refuses to drop a role that owns objects. Either failure stops the apply
  // part-way through a teardown. Deleting the instance removes both, so
  // Terraform forgets them instead.
  const removed = () => parsed['removed-metabase.tf']?.removed ?? [];

  it.each(['google_sql_database.metabase', 'google_sql_user.metabase'])(
    'forgets %s without destroying it',
    (address) => {
      const block = removed().find((r: { from: string }) => r.from === `\${${address}}`);
      expect(block).toBeDefined();
      expect(block.lifecycle[0].destroy).toBe(false);
    },
  );

  it('forgets nothing else, so every other removal is a destroy the plan shows', () => {
    expect(removed()).toHaveLength(2);
  });
});

describe('[18.3] the Metabase code and its runbook are gone', () => {
  it.each(['infrastructure/metabase', 'docs/runbook/metabase-access.md', 'tests/unit/metabase'])(
    '%s no longer exists',
    (p) => {
      expect(existsSync(path.join(ROOT, p))).toBe(false);
    },
  );
});

/**
 * The site says no dashboard is live once Metabase is gone.
 *
 * The shop's order confirmation and warehouse-write diagnostics tag a dashboard
 * step `[LIVE]`. That was true while Metabase ran behind IAP; after this
 * change's apply there is no dashboard, so the claim would be false on the
 * public site. The replacement wording is Ian's under the claims rules, so this
 * test does not propose any: it is red until his copy lands, and that is the
 * gate, on purpose.
 */
describe('[18.3] no visitor-facing copy claims a live dashboard', () => {
  const SRC = path.join(ROOT, 'src');
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory()
        ? files(path.join(dir, e.name))
        : /\.(tsx?|mdx?)$/.test(e.name)
          ? [path.join(dir, e.name)]
          : [],
    );

  it('reads src/, so an empty walk is not a silent pass', () => {
    expect(files(SRC).length).toBeGreaterThan(20);
  });

  it('tags no dashboard step [LIVE]', () => {
    const offenders: string[] = [];
    for (const f of files(SRC)) {
      readFileSync(f, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (/dashboard/i.test(line) && /\btag:\s*['"]LIVE['"]/.test(line))
            offenders.push(`${path.relative(ROOT, f)}:${i + 1}: ${line.trim()}`);
        });
    }
    expect(offenders).toEqual([]);
  });

  it.each(['dashboard KPIs reflect this order', 'dashboards · revenue KPI refreshing'])(
    'no longer says "%s"',
    (claim) => {
      const hits = files(SRC).filter((f) => readFileSync(f, 'utf8').includes(claim));
      expect(hits.map((f) => path.relative(ROOT, f))).toEqual([]);
    },
  );
});
