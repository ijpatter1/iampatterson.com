/**
 * @jest-environment node
 *
 * Phase 11 D9 — Cloud Run service pins.
 *
 * Terraform owns the durable service shell; the deploy pipeline owns the rolling
 * image. The pins assert the security-relevant shell config (metabase reachable
 * only via the LB, secret env wired to Secret Manager, deletion protection) and
 * the ignore_changes contract that keeps Terraform from fighting deploys.
 */
import { parse } from '@cdktf/hcl2json';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const TF_DIR = path.join(process.cwd(), 'infrastructure', 'terraform');
const read = (file: string): string => readFileSync(path.join(TF_DIR, file), 'utf8');

const SERVICES = ['event_stream', 'data_generator', 'sgtm', 'sgtm_preview', 'metabase'];
const SOURCE_DEPLOY = ['event_stream', 'data_generator'];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let svc: Record<string, any>;

beforeAll(async () => {
  const json = await parse('cloud-run.tf', read('cloud-run.tf'));
  svc = json.resource.google_cloud_run_v2_service;
});

describe('Phase 11 D9 — Cloud Run services', () => {
  it('imports all five services', () => {
    for (const name of SERVICES) {
      expect(svc[name]).toBeDefined();
    }
  });

  describe('metabase service shell (security-relevant)', () => {
    it('is reachable ONLY via the internal load balancer (not the public internet)', () => {
      expect(svc.metabase[0].ingress).toBe('INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER');
    });

    it('runs as the dedicated metabase-runtime service account', () => {
      expect(svc.metabase[0].template[0].service_account).toBe(
        'metabase-runtime@iampatterson.iam.gserviceaccount.com',
      );
    });

    it('wires DB password + encryption key from Secret Manager (never inlined)', () => {
      const envs = svc.metabase[0].template[0].containers[0].env;
      const secretOf = (name: string) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        envs.find((e: any) => e.name === name)?.value_source?.[0]?.secret_key_ref?.[0]?.secret;
      expect(secretOf('MB_DB_PASS')).toBe('metabase-db-password');
      expect(secretOf('MB_ENCRYPTION_SECRET_KEY')).toBe('metabase-encryption-key');
    });
  });

  describe('deploy-safety contract', () => {
    it.each(SERVICES)('%s enables deletion protection', (name) => {
      expect(svc[name][0].deletion_protection).toBe(true);
    });

    it.each(SERVICES)(
      '%s ignores the rolling image + client annotations so deploys do not drift',
      (name) => {
        const ignored = svc[name][0].lifecycle[0].ignore_changes;
        expect(ignored).toEqual(
          expect.arrayContaining([
            '${client}',
            '${client_version}',
            '${template[0].containers[0].image}',
          ]),
        );
      },
    );

    it.each(SOURCE_DEPLOY)('source-deploy service %s also ignores build_config', (name) => {
      expect(svc[name][0].lifecycle[0].ignore_changes).toContain('${build_config}');
    });
  });

  describe('hygiene', () => {
    it('pins no :latest container image (sgtm rides :stable by design)', () => {
      for (const name of SERVICES) {
        const image = svc[name][0].template[0].containers[0].image as string;
        expect(image).not.toMatch(/:latest$/);
      }
    });
  });
});
