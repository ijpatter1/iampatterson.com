/**
 * @jest-environment node
 *
 * Phase 11 D9 — Metabase load-balancer / IAP module pins.
 *
 * The headline assertion is the IAP path split: a regression here is the exact
 * Phase 9F production incident (an asset path silently falling under IAP).
 */
import { parse } from '@cdktf/hcl2json';
import { readFileSync, readdirSync } from 'node:fs';
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

    it('carves only the signed-embed surface out to the non-IAP backend', () => {
      expect(rule.service).toBe(DIRECT_BACKEND);
      // Exact set, not arrayContaining: a NEW path silently added to the non-IAP
      // carve-out (e.g. /admin/* leaking out from behind IAP — the inverse of the
      // 9F incident) must fail this pin, not slip through.
      expect([...rule.paths].sort()).toEqual(['/api/embed/*', '/app/*', '/embed/*']);
    });

    it('never routes a carve-out path to the IAP backend', () => {
      // The whole point: these must hit the direct (non-IAP) backend.
      expect(rule.service).not.toBe(IAP_BACKEND);
      for (const p of ['/api/embed/*', '/app/*', '/embed/*']) {
        expect(rule.paths).toContain(p);
      }
    });

    it('keeps every Metabase API path except the embed API behind IAP', () => {
      // CVE-2026-72898 is an unauthenticated SQL injection in
      // /api/session/reset_password. It was exploited through the old /api/*
      // carve-out on 2026-09-03, 09-04 and 09-10 to take over the admin account
      // and read every setting, including a stored API key. The public site only
      // needs the signed-JWT embed API, so any broader /api path here must fail.
      for (const p of rule.paths) {
        expect(p).not.toBe('/api/*');
        if (p.startsWith('/api/')) {
          expect(p.startsWith('/api/embed/')).toBe(true);
        }
      }
    });
  });

  describe('url_map IAP invariants across every rule (CVE-2026-72898)', () => {
    const EMBED_SURFACE = ['/api/embed/*', '/app/*', '/embed/*'];

    it('sends nothing outside the embed surface to the non-IAP backend, on any matcher or rule', () => {
      // The pins above read only the first path_rule. A second rule or matcher
      // sending /api/session/* to the direct backend would reopen the exploited
      // surface without failing them, so every rule is checked here.
      const urlMap = tf.resource.google_compute_url_map.metabase[0];
      expect(urlMap.path_matcher.every((m: { route_rules?: unknown }) => m.route_rules === undefined)).toBe(true);
      for (const m of urlMap.path_matcher) {
        for (const r of m.path_rule ?? []) {
          if (r.service === DIRECT_BACKEND) {
            for (const p of r.paths) expect(EMBED_SURFACE).toContain(p);
          }
        }
      }
    });

    it('fails closed: the url-map default is the IAP backend', () => {
      // Until 2026-09-11 this defaulted to the direct backend, unreachable only
      // while a host rule matched "*". Any Host header not matching a rule would
      // otherwise reach every Metabase path without IAP.
      const urlMap = tf.resource.google_compute_url_map.metabase[0];
      expect(urlMap.default_service).toBe(IAP_BACKEND);
    });

    it('routes every matcher default to the IAP backend, not just the first', () => {
      // A second host rule for bi.iampatterson.com pointing at a matcher whose
      // default_service is the direct backend would send the whole host around
      // IAP with no path rule to inspect, so every pin above would still pass.
      const urlMap = tf.resource.google_compute_url_map.metabase[0];
      for (const m of urlMap.path_matcher as { default_service: string }[]) {
        expect(m.default_service).toBe(IAP_BACKEND);
      }
    });

    it('leaves /api/session/properties behind IAP (embeds render without it)', () => {
      // The embed frontend requests /api/session/properties, which returns
      // admin-only settings to an admin session. Anonymous embeds render without
      // it (checked in a private window on 2026-09-11), so it stays IAP-gated.
      const urlMap = tf.resource.google_compute_url_map.metabase[0];
      const direct = urlMap.path_matcher
        .flatMap((m: { path_rule?: { service: string; paths: string[] }[] }) => m.path_rule ?? [])
        .filter((r: { service: string }) => r.service === DIRECT_BACKEND)
        .flatMap((r: { paths: string[] }) => r.paths);
      expect(direct).not.toContain('/api/session/properties');
      expect(direct).not.toContain('/api/session/*');
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

  it('uses the additive per-member resource, not an authoritative one — anywhere in the root', () => {
    // _iam_binding or _iam_policy is authoritative: on first apply it revokes
    // every member this configuration does not name, including the `allUsers`
    // binding deliberately left alone and the IAP service agent binding this
    // deliverable just imported. The resource TYPE is the safety property.
    //
    // Scoped to the whole root, not this file. [14.5] is queued to add the
    // first IAM resources here; an authoritative binding dropped into iam.tf
    // or cloud-run.tf would pass a file-scoped check and still revoke them.
    const dir = path.join(TF_DIR);
    const offenders: string[] = [];
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.tf'))) {
      const body = readFileSync(path.join(dir, file), 'utf8');
      if (/resource\s+"google_cloud_run_v2_service_iam_(binding|policy)"/.test(body)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('is imported rather than created, since it already exists live', () => {
    expect(read('imports-lb.tf')).toContain(
      'google_cloud_run_v2_service_iam_member.metabase_iap_agent',
    );
  });
});
