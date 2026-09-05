/**
 * Retention and cost controls as committed configuration (Phase 13, 13.1).
 *
 * The spec is where the decisions live; these pins hold the ones that would be
 * expensive to get wrong and cheap to break by accident.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');

interface Dataset {
  dataset: string;
  partitionExpirationDays: number | null;
  rationale: string;
}
interface Bucket {
  name: string;
  ageDays: number | null;
  action: string | null;
  rationale: string;
}
interface Spec {
  bigquery: { datasets: Dataset[] };
  gcs: { buckets: Bucket[]; _absent: { name: string; declaredBy: string; finding: string } };
  logging: { bucket: string; retentionDays: number; confirms: string; rationale: string };
  budgets: { displayName: string; amountUsd: number; channels: string[]; rationale: string }[];
  vertexBudget: { create: boolean; rationale: string };
}

const spec = JSON.parse(read('infrastructure/retention/spec/retention.json')) as Spec;
const script = read('infrastructure/retention/apply.sh');

describe('infrastructure/retention/spec/retention.json', () => {
  it('gives every decision a reason, because the reason is what cannot be re-derived', () => {
    for (const d of spec.bigquery.datasets) expect(d.rationale.length).toBeGreaterThan(60);
    for (const b of spec.gcs.buckets) expect(b.rationale.length).toBeGreaterThan(60);
    expect(spec.logging.rationale.length).toBeGreaterThan(60);
    expect(spec.budgets[0].rationale.length).toBeGreaterThan(60);
    expect(spec.vertexBudget.rationale.length).toBeGreaterThan(60);
  });

  it('expires raw partitions and deliberately does not expire the derived datasets', () => {
    const byName = Object.fromEntries(spec.bigquery.datasets.map((d) => [d.dataset, d]));
    expect(byName.iampatterson_raw.partitionExpirationDays).toBe(60);
    // Derived from raw by Dataform: a second expiry could disagree with the first.
    for (const ds of ['iampatterson_staging', 'iampatterson_marts', 'iampatterson_assertions']) {
      expect(byName[ds].partitionExpirationDays).toBeNull();
    }
  });

  it('never puts a lifecycle rule on the Terraform state bucket', () => {
    // Its object versions are the only record that the 2026-06-08 import session
    // happened at all. A rule here trades forensic history for kilobytes.
    const tfstate = spec.gcs.buckets.find((b) => b.name === 'iampatterson-tfstate');
    expect(tfstate).toBeDefined();
    expect(tfstate?.ageDays).toBeNull();
    expect(tfstate?.action).toBeNull();
  });

  it('expires the two build-artifact buckets', () => {
    for (const name of ['run-sources-iampatterson-us-central1', 'iampatterson_cloudbuild']) {
      const b = spec.gcs.buckets.find((x) => x.name === name);
      expect(b?.action).toBe('Delete');
      expect(b?.ageDays).toBe(90);
    }
  });

  it('records that the AI export bucket the deliverable names does not exist', () => {
    expect(spec.gcs._absent.name).toBe('gs://iampatterson-ai-exports');
    expect(spec.gcs._absent.declaredBy).toContain('ai_access_layer/setup.sh');
  });

  it('attaches no pubsub-type channel to the budget', () => {
    // Cloud Billing rejects one with INVALID_ARGUMENT, and the separate
    // pubsubTopic path would put budget-shaped messages on the topic the
    // monitoring rehearsals pull from with an alert-JSON parser.
    expect(spec.budgets[0].channels).toEqual(['ops-email']);
  });
});

describe('the _Default log retention has one writer and one value', () => {
  const monitoring = JSON.parse(read('infrastructure/monitoring/spec/retention.json')) as {
    bucket: string;
    retentionDays: number;
    status: string;
  };

  it('agrees across both specs, so a change to one cannot silently diverge', () => {
    expect(monitoring.bucket).toBe(spec.logging.bucket);
    expect(monitoring.retentionDays).toBe(spec.logging.retentionDays);
  });

  it('is no longer provisional, which is the obligation 12.3 handed to 13.1', () => {
    expect(monitoring.status).not.toMatch(/^provisional/);
    expect(monitoring.status).toContain('confirmed by 13.1');
    expect(spec.logging.confirms).toBe('12.3');
  });
});

describe('infrastructure/retention/apply.sh', () => {
  it('honours --dry-run in any position, not only as the first token', () => {
    // Phase 12 shipped a script where the flag was positional, so
    // `apply.sh apply --dry-run` performed a real apply.
    expect(script).toMatch(/while \[ \$# -gt 0 \]/);
    expect(script).toMatch(/--dry-run\)\s*DRY=1/);
  });

  it('refuses two commands rather than silently running one of them', () => {
    expect(script).toContain('two commands given');
  });

  it('reports partition expiration but never writes it', () => {
    // A script that silently changes how long data lives can delete history as
    // a side effect of being run. Reported by apply, changed only by hand.
    expect(script).toContain('values are confirmed by measure');
    expect(script).not.toMatch(/bq update .*--default_partition_expiration/);
  });
});
