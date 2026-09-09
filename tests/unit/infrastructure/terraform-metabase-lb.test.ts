/**
 * @jest-environment node
 *
 * Phase 11 D9 — Metabase load-balancer / IAP module pins.
 *
 * The headline assertion is the IAP path split: a regression here is the exact
 * Phase 9F production incident (an asset path silently falling under IAP).
 */
import { parse } from '@cdktf/hcl2json';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const TF_DIR = path.join(process.cwd(), 'infrastructure', 'terraform');
const read = (file: string): string => readFileSync(path.join(TF_DIR, file), 'utf8');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let tf: any;

beforeAll(async () => {
  tf = await parse('metabase-lb.tf', read('metabase-lb.tf'));
});

const IAP_BACKEND = '${google_compute_backend_service.metabase_backend.id}';
const DIRECT_BACKEND = '${google_compute_backend_service.metabase_backend_direct.id}';

describe('Phase 11 D9 — Metabase LB/IAP', () => {
  describe('url_map IAP path split (9F drift surface)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let matcher: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rule: any;

    beforeAll(() => {
      const urlMap = tf.resource.google_compute_url_map.metabase[0];
      matcher = urlMap.path_matcher[0];
      rule = matcher.path_rule[0];
    });

    it('routes unmatched paths (the UI) to the IAP-gated backend by default', () => {
      expect(matcher.default_service).toBe(IAP_BACKEND);
    });

    it('carves /api, /app, /embed out to the non-IAP backend', () => {
      expect(rule.service).toBe(DIRECT_BACKEND);
      // Exact set, not arrayContaining: a NEW path silently added to the non-IAP
      // carve-out (e.g. /admin/* leaking out from behind IAP — the inverse of the
      // 9F incident) must fail this pin, not slip through.
      expect([...rule.paths].sort()).toEqual(['/api/*', '/app/*', '/embed/*']);
    });

    it('never routes a carve-out path to the IAP backend', () => {
      // The whole point: these must hit the direct (non-IAP) backend.
      expect(rule.service).not.toBe(IAP_BACKEND);
      for (const p of ['/api/*', '/app/*', '/embed/*']) {
        expect(rule.paths).toContain(p);
      }
    });
  });

  describe('backend services', () => {
    it('enables IAP on the default backend with the secret pulled from Secret Manager', () => {
      const iap = tf.resource.google_compute_backend_service.metabase_backend[0].iap[0];
      expect(iap.enabled).toBe(true);
      expect(iap.oauth2_client_secret).toBe(
        '${data.google_secret_manager_secret_version.metabase_iap_client_secret.secret_data}',
      );
    });

    it('leaves the direct backend non-IAP (no iap block)', () => {
      const direct = tf.resource.google_compute_backend_service.metabase_backend_direct[0];
      expect(direct.iap).toBeUndefined();
    });

    it('matches live connection draining (0) on both backends so import is a no-op', () => {
      expect(
        tf.resource.google_compute_backend_service.metabase_backend[0]
          .connection_draining_timeout_sec,
      ).toBe(0);
      expect(
        tf.resource.google_compute_backend_service.metabase_backend_direct[0]
          .connection_draining_timeout_sec,
      ).toBe(0);
    });
  });

  describe('serving topology', () => {
    it('fronts the Cloud Run metabase service via a serverless NEG', () => {
      const neg = tf.resource.google_compute_region_network_endpoint_group.metabase_neg[0];
      expect(neg.network_endpoint_type).toBe('SERVERLESS');
      expect(neg.cloud_run[0].service).toBe('metabase');
    });

    it('serves the bi.iampatterson.com managed certificate over :443', () => {
      const cert = tf.resource.google_compute_managed_ssl_certificate.metabase[0];
      expect(cert.managed[0].domains).toContain('bi.iampatterson.com');
      const fr = tf.resource.google_compute_global_forwarding_rule.metabase[0];
      expect(fr.port_range).toBe('443-443');
    });
  });

  describe('hygiene', () => {
    it('inlines no IAP client secret literal (only the Secret Manager reference)', () => {
      const text = read('metabase-lb.tf');
      // The public client_id may be inlined; the secret must be a data reference.
      expect(text).toMatch(/oauth2_client_secret\s*=\s*data\.google_secret_manager_secret_version/);
      expect(text).not.toMatch(/oauth2_client_secret\s*=\s*"[^"$]/);
    });
  });
});

/**
 * The IAP service agent, declared by [14.2] when `setup-iap.sh` was retired.
 *
 * Without this binding IAP authenticates a browser request and then cannot
 * forward it: every request through the load balancer returns 403 while the
 * Cloud Run service is healthy, and neither the LB nor the service logs name
 * the cause. It was created by a one-shot script that no longer exists.
 */
describe('IAP service agent binding', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let member: any;

  beforeAll(async () => {
    const json = await parse('metabase-lb.tf', read('metabase-lb.tf'));
    member = json.resource.google_cloud_run_v2_service_iam_member?.metabase_iap_agent?.[0];
  });

  it('grants run.invoker to the IAP service agent on the metabase service', () => {
    expect(member).toBeDefined();
    expect(member.role).toBe('roles/run.invoker');
    expect(member.member).toContain('gcp-sa-iap.iam.gserviceaccount.com');
  });

  it('uses the additive per-member resource, not an authoritative one', () => {
    // _iam_binding or _iam_policy would revoke every member this configuration
    // does not name the first time it applied — including the `allUsers`
    // binding that is deliberately left alone, and any IAP allowlist entry.
    // The resource type IS the safety property here.
    const tf = read('metabase-lb.tf');
    expect(tf).not.toMatch(/resource\s+"google_cloud_run_v2_service_iam_binding"/);
    expect(tf).not.toMatch(/resource\s+"google_cloud_run_v2_service_iam_policy"/);
  });

  it('is imported rather than created, since it already exists live', () => {
    expect(read('imports-lb.tf')).toContain(
      'google_cloud_run_v2_service_iam_member.metabase_iap_agent',
    );
  });
});
