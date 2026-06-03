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
      expect(rule.paths).toEqual(expect.arrayContaining(['/api/*', '/app/*', '/embed/*']));
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
