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
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const TF_DIR = path.join(process.cwd(), 'infrastructure', 'terraform');
const read = (file: string): string => readFileSync(path.join(TF_DIR, file), 'utf8');

const SERVICES = ['event_stream', 'data_generator', 'sgtm', 'sgtm_preview', 'metabase', 'claudish_proxy'];
const SOURCE_DEPLOY = ['event_stream', 'data_generator', 'claudish_proxy'];

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

    it('wires every Metabase secret from Secret Manager (never inlined)', () => {
      const envs = svc.metabase[0].template[0].containers[0].env;
      const secretOf = (name: string) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        envs.find((e: any) => e.name === name)?.value_source?.[0]?.secret_key_ref?.[0]?.secret;
      expect(secretOf('MB_DB_PASS')).toBe('metabase-db-password');
      expect(secretOf('MB_ENCRYPTION_SECRET_KEY')).toBe('metabase-encryption-key');
      // The embedding secret signs every static-embed JWT the public site mints.
      // It came from the app database until 2026-09-11, where the CVE-2026-72898
      // admin reads exposed it; sourcing it here is what made rotation possible
      // without the IAP-gated admin UI, and the env value wins over the stored one.
      expect(secretOf('MB_EMBEDDING_SECRET_KEY')).toBe('metabase-embedding-secret-key');
    });
  });

  describe('the two writers on the metabase service agree', () => {
    // deploy.sh applies infrastructure/metabase/cloudrun.yaml whole, via
    // `gcloud run services replace`. A secret Terraform sets and that file
    // omits is therefore removed by the next deploy or upgrade — which for
    // MB_EMBEDDING_SECRET_KEY means falling back to the value the
    // CVE-2026-72898 admin reads exposed, silently.
    const yaml = readFileSync(
      path.join(process.cwd(), 'infrastructure', 'metabase', 'cloudrun.yaml'),
      'utf8',
    );

    it('declares every secret-backed metabase env in cloudrun.yaml too', () => {
      const envs = svc.metabase[0].template[0].containers[0].env;
      const secretEnvs: [string, string][] = envs
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((e: any) => e.value_source?.[0]?.secret_key_ref?.[0]?.secret)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((e: any) => [e.name, e.value_source[0].secret_key_ref[0].secret]);

      expect(secretEnvs.length).toBeGreaterThanOrEqual(3);
      for (const [name, secret] of secretEnvs) {
        expect(yaml).toContain(`- name: ${name}`);
        expect(yaml).toContain(`name: ${secret}`);
      }
    });

    it('caps the app-DB pool in both writers, so two revisions can overlap', () => {
      // Budget, measured rather than assumed. db-f1-micro's max_connections is
      // the memory-derived default (~25) and Postgres holds back
      // superuser_reserved_connections (3), so ~22 is usable — which is exactly
      // where num_backends peaked when metabase-00006-zzk failed on 2026-09-11.
      // Raising the ceiling is not an option at this tier: each connection costs
      // several MB against 0.6 GB of RAM. See docs/BACKLOG.md.
      const USABLE_CONNECTIONS = 22;
      // metabase-00006-zzk failed its startup probe on 2026-09-11 with
      // "remaining connection slots are reserved for non-replication superuser
      // connections". The app DB is db-f1-micro (max_connections ~25) and
      // MB_APPLICATION_DB_MAX_CONNECTION_POOL_SIZE defaults to 15, so a rollout
      // — where the old and new revisions each hold a pool — cannot fit. That
      // blocks every config change, including the next security patch.
      const envs = svc.metabase[0].template[0].containers[0].env;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pool = envs.find((e: any) => e.name === 'MB_APPLICATION_DB_MAX_CONNECTION_POOL_SIZE');
      expect(pool).toBeDefined();
      expect(Number(pool.value)).toBeGreaterThan(0);
      // A rollout runs the old and new revisions at once, so two capped pools
      // must fit. This is the arithmetic, not a taste for small numbers.
      expect(2 * Number(pool.value)).toBeLessThanOrEqual(USABLE_CONNECTIONS);

      // Match the name and value as one entry, and only outside comments: a
      // commented-out pair satisfies two independent substring checks while
      // `gcloud run services replace` ships a spec with no cap at all.
      const entry = yaml.match(
        /^(?!\s*#)\s*- name: MB_APPLICATION_DB_MAX_CONNECTION_POOL_SIZE\n(?!\s*#)\s*value: '(\d+)'$/m,
      );
      expect(entry).not.toBeNull();
      expect(entry?.[1]).toBe(String(pool.value));
    });

    it('keeps Terraform owning the metabase env block, so a stripped secret is restored', () => {
      // The inverse of the claudish-proxy kill-switch case below: that env is a
      // value a human sets mid-incident, this one is a reference to a secret.
      // If env joined ignore_changes, a deploy.sh removal would never be undone.
      const ignored = svc.metabase[0].lifecycle[0].ignore_changes;
      expect(ignored).not.toContain('${template[0].containers[0].env}');
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
    // sgtm and sgtm-preview pin a digest as of 13.2; :latest stays forbidden for
    // every service. The old parenthetical here said sgtm rides :stable, which
    // this same change reversed.
    it('pins no :latest container image', () => {
      for (const name of SERVICES) {
        const image = svc[name][0].template[0].containers[0].image as string;
        expect(image).not.toMatch(/:latest$/);
      }
    });
  });
});

/**
 * Every source-deployed service is declared (Phase 14, deliverable 14.5).
 *
 * `claudish-proxy` was absent from `cloud-run.tf` for three months and nothing
 * noticed. `terraform plan` could not: a resource in neither the configuration
 * nor the state produces no plan output at all — the plan only ever describes
 * the gap between those two, so it is structurally silent about a resource in
 * neither. 13.4's record said "the proxy adoption imported", which was true of
 * six other resources and not of the service.
 *
 * The census that would have caught it has to come from something current by
 * construction. `IMPORT_INVENTORY.md` is not: it is dated 2026-06-03 and
 * claudish-proxy entered the repo on 2026-09-03, so a pin against the inventory
 * would have been green throughout the miss. A source-deployed service cannot
 * exist without its directory, so the directory listing is the honest census.
 */
describe('14.5 — every source-deployed service is in the declarative layer', () => {
  const serviceDirs = readdirSync(path.join(TF_DIR, '..', 'cloud-run'), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  it('finds the service directories, so an empty read is not a silent pass', () => {
    expect(serviceDirs).toEqual(['claudish-proxy', 'data-generator', 'event-stream']);
  });

  it.each(serviceDirs)('%s has a google_cloud_run_v2_service declaration', (dir) => {
    // Would have failed on 2026-09-03, the day claudish-proxy entered the repo.
    const resourceName = dir.replace(/-/g, '_');
    expect(Object.keys(svc)).toContain(resourceName);
  });
});

describe('14.5 — the claudish proxy carries the kill-switch treatment', () => {
  it('is declared as a source-deploy service like its siblings', () => {
    expect(svc.claudish_proxy).toBeDefined();
    expect(svc.claudish_proxy[0].deletion_protection).toBe(true);
  });

  it('excludes the env block from ignore_changes, which the kill switch depends on', () => {
    // IMPORT_PLAN.md calls this "the class of thing this plan exists to catch":
    // KILL_SWITCH lives in the service env, so if Terraform owns that block an
    // emergency `gcloud run services update --update-env-vars KILL_SWITCH=on`
    // is silently reverted by the next apply — mid-incident.
    const ignored = svc.claudish_proxy[0].lifecycle[0].ignore_changes;
    expect(ignored).toEqual(
      expect.arrayContaining([
        '${client}',
        '${client_version}',
        '${build_config}',
        '${template[0].containers[0].image}',
        '${template[0].containers[0].env}',
      ]),
    );
  });

  it('runs as its own runtime identity, not the default compute account', () => {
    expect(svc.claudish_proxy[0].template[0].service_account).toBe(
      'claudish-proxy@iampatterson.iam.gserviceaccount.com',
    );
  });
});
