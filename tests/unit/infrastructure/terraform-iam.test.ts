/**
 * @jest-environment node
 *
 * The identity layer is declared, not only applied (Phase 14, deliverable 14.5).
 *
 * [13.4] moved every Cloud Run service off the default compute account onto
 * dedicated runtime identities and proved each move by counting rows in
 * BigQuery. It did not declare the grants. This root held no IAM resources of
 * any kind, so every binding existed only in live IAM, `terraform plan`
 * reported "No changes" while describing none of it, and nothing would have
 * noticed a revocation.
 */
import { parse } from '@cdktf/hcl2json';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const TF_DIR = path.join(process.cwd(), 'infrastructure', 'terraform');
const read = (file: string): string => readFileSync(path.join(TF_DIR, file), 'utf8');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let iam: any;

beforeAll(async () => {
  const json = await parse('iam.tf', read('iam.tf'));
  iam = json;
});

describe('runtime identities hold the roles 13.4 gave them', () => {
  it.each([
    ['claudish_proxy_aiplatform', 'claudish-proxy', 'roles/aiplatform.user'],
    ['data_gen_runtime_bigquery_job', 'data-gen-runtime', 'roles/bigquery.jobUser'],
    ['metabase_runtime_cloudsql', 'metabase-runtime', 'roles/cloudsql.client'],
    ['metabase_bigquery_job', 'metabase-bigquery', 'roles/bigquery.jobUser'],
  ])('%s grants %s the role it needs', (key, account, role) => {
    const entry = iam.locals[0].runtime_project_roles[key];
    expect(entry.member).toContain(`${account}@iampatterson.iam.gserviceaccount.com`);
    expect(entry.role).toBe(role);
  });

  it('records that two runtimes deliberately hold no project role', () => {
    // sgtm-runtime and event-stream-runtime holding nothing is the
    // least-privilege result 13.4 was after, not an omission. Without this the
    // absence reads as a gap and someone "fixes" it by granting something.
    const declared = JSON.stringify(iam.locals[0].runtime_project_roles);
    expect(declared).not.toContain('sgtm-runtime@');
    expect(declared).not.toContain('event-stream-runtime@');
    expect(read('iam.tf')).toMatch(/sgtm-runtime and event-stream-runtime deliberately hold none/);
  });
});

describe('IAM resources are additive, everywhere in the root', () => {
  it('uses no authoritative project IAM resource', () => {
    // _binding is authoritative for a role and _policy for the whole project:
    // either would revoke every principal this configuration does not name on
    // first apply, including Google-managed service agents.
    const offenders: string[] = [];
    for (const file of readdirSync(TF_DIR).filter((f) => f.endsWith('.tf'))) {
      const body = readFileSync(path.join(TF_DIR, file), 'utf8');
      if (/resource\s+"google_project_iam_(binding|policy)"/.test(body)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it('imports every binding rather than creating it', () => {
    // These grants already exist live. An import that is not declared would
    // mean Terraform creating a duplicate binding on first apply.
    const imports = read('imports-iam.tf');
    for (const key of [
      'claudish_proxy_aiplatform',
      'data_gen_runtime_bigquery_job',
      'metabase_runtime_cloudsql',
      'metabase_bigquery_job',
    ]) {
      expect(imports).toContain(`google_project_iam_member.runtime["${key}"]`);
    }
  });
});
