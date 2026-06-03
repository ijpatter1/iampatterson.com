/**
 * @jest-environment node
 *
 * Phase 11 D9 — Terraform foundation pins.
 *
 * These parse the committed HCL (via @cdktf/hcl2json) and assert the structural
 * invariants that keep the brownfield import safe and reproducible. They are the
 * in-suite regression gate; the authoritative validity check is the live
 * `terraform validate` + no-op `plan` run in CI (`.github/workflows/infra-terraform.yml`).
 */
import { parse } from '@cdktf/hcl2json';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const TF_DIR = path.join(process.cwd(), 'infrastructure', 'terraform');
const FOUNDATION_FILES = [
  'backend.tf',
  'versions.tf',
  'providers.tf',
  'variables.tf',
  'project-services.tf',
  'service-accounts.tf',
  'imports.tf',
];

const read = (file: string): string => readFileSync(path.join(TF_DIR, file), 'utf8');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const parseTf = (file: string): Promise<any> => parse(file, read(file));

describe('Phase 11 D9 — Terraform foundation', () => {
  describe('remote state backend (backend.tf)', () => {
    it('pins the GCS backend to the iampatterson-tfstate bucket with a prefix', async () => {
      const json = await parseTf('backend.tf');
      const gcs = json.terraform[0].backend.gcs[0];
      expect(gcs.bucket).toBe('iampatterson-tfstate');
      expect(gcs.prefix).toBeTruthy();
    });

    it('declares no local backend (state never lives on disk)', () => {
      const all = FOUNDATION_FILES.map(read).join('\n');
      expect(all).not.toMatch(/backend\s+"local"/);
    });
  });

  describe('provider + version constraints (versions.tf)', () => {
    it('pins google + google-beta to hashicorp with a version constraint', async () => {
      const json = await parseTf('versions.tf');
      const rp = json.terraform[0].required_providers[0];
      expect(rp.google.source).toBe('hashicorp/google');
      expect(rp.google.version).toMatch(/\d/);
      expect(rp['google-beta'].source).toBe('hashicorp/google-beta');
      expect(rp['google-beta'].version).toMatch(/\d/);
      expect(json.terraform[0].required_version).toMatch(/\d/);
    });
  });

  describe('service accounts (service-accounts.tf)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let serviceAccounts: Record<string, any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let resource: any;

    beforeAll(async () => {
      const json = await parseTf('service-accounts.tf');
      serviceAccounts = json.locals[0].service_accounts;
      resource = json.resource.google_service_account.managed[0];
    });

    it('declares exactly the five user-created service accounts', () => {
      expect(Object.keys(serviceAccounts).sort()).toEqual([
        'claude_code_sandbox',
        'data_gen_scheduler',
        'metabase_bigquery',
        'metabase_runtime',
        'stape_sgtm',
      ]);
    });

    it.each([
      ['metabase_runtime', 'metabase-runtime'],
      ['metabase_bigquery', 'metabase-bigquery'],
      ['data_gen_scheduler', 'data-gen-scheduler'],
      ['stape_sgtm', 'stape-sgtm'],
      ['claude_code_sandbox', 'claude-code-sandbox'],
    ])('maps %s to the live account_id %s', (key, accountId) => {
      expect(serviceAccounts[key].account_id).toBe(accountId);
    });

    it('preserves the live stape-sgtm description so import converges to a no-op', () => {
      expect(serviceAccounts.stape_sgtm.description).toMatch(/Stape/);
    });

    it('provisions every account through one for_each resource over the local map', () => {
      expect(resource.for_each).toBe('${local.service_accounts}');
      expect(resource.account_id).toBe('${each.value.account_id}');
      expect(resource.display_name).toBe('${each.value.display_name}');
    });

    it('excludes the Google-managed default compute service account', () => {
      const accountIds = Object.values(serviceAccounts).map((s) => s.account_id as string);
      expect(accountIds).not.toContain('262727068689-compute');
      expect(accountIds.some((id) => id.endsWith('-compute'))).toBe(false);
    });
  });

  describe('project services (project-services.tf)', () => {
    let services: string[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let resource: any;

    beforeAll(async () => {
      const json = await parseTf('project-services.tf');
      services = json.locals[0].enabled_services;
      resource = json.resource.google_project_service.enabled[0];
    });

    it('manages the core APIs the stack depends on', () => {
      const required = [
        'run',
        'sqladmin',
        'compute',
        'pubsub',
        'bigquery',
        'secretmanager',
        'cloudscheduler',
        'iap',
      ].map((s) => `${s}.googleapis.com`);
      for (const api of required) {
        expect(services).toContain(api);
      }
    });

    it('never disables an API on destroy (production safety)', () => {
      expect(resource.disable_on_destroy).toBe(false);
      expect(resource.disable_dependent_services).toBe(false);
    });
  });

  describe('brownfield import blocks (imports.tf)', () => {
    it('adopts services + service accounts via for_each import blocks', async () => {
      const json = await parseTf('imports.tf');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const targets = json.import.map((b: any) => b.to);
      expect(targets).toEqual(
        expect.arrayContaining([
          '${google_project_service.enabled[each.value]}',
          '${google_service_account.managed[each.key]}',
        ]),
      );
    });
  });

  describe('hygiene (all foundation .tf)', () => {
    it('pins no :latest image tags and inlines no private keys', () => {
      const all = FOUNDATION_FILES.map(read).join('\n');
      expect(all).not.toMatch(/:latest/);
      expect(all).not.toMatch(/BEGIN [A-Z ]*PRIVATE KEY/);
    });
  });
});
