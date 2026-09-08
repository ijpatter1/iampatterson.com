/**
 * The event-stream CORS allowlist (Phase 13 review gate, 2026-09-08).
 *
 * A live defect these pins exist to prevent recurring. Production redirects the
 * apex to `https://www.iampatterson.com`, so `www` is the browser origin for
 * every real visitor — and it was missing from the allowlist. `server.ts` falls
 * back to `ALLOWED_ORIGINS[0]` for an unlisted origin, so a `www` client
 * received `Access-Control-Allow-Origin: https://iampatterson-com.vercel.app`,
 * the browser rejected the mismatch, and `EventSource` failed. The real-time
 * overlay — the thesis the site is built to demonstrate — did not work in
 * production, while working from the bare apex, which is why it went unnoticed.
 *
 * The value is declared in three places that must agree, because any one of
 * them can silently reintroduce the fault: the code default, the Terraform
 * resource (whose `env` is NOT in `ignore_changes`, so an apply overwrites the
 * live value), and the proxy's setup script.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');

const PRODUCTION_ORIGIN = 'https://www.iampatterson.com';

const server = read('infrastructure/cloud-run/event-stream/src/server.ts');
const tf = read('infrastructure/terraform/cloud-run.tf');
const proxySetup = read('infrastructure/cloud-run/claudish-proxy/setup.sh');

/** The comma-separated allowlist declared in the Terraform resource. */
const tfAllowlist = (): string[] => {
  const m = /name\s*=\s*"ALLOWED_ORIGINS"\s*\n\s*value\s*=\s*"([^"]+)"/.exec(tf);
  if (!m) throw new Error('ALLOWED_ORIGINS not found in cloud-run.tf');
  return m[1].split(',');
};

/** The fallback default compiled into the service. */
const serverDefault = (): string[] => {
  const m = /process\.env\.ALLOWED_ORIGINS \?\?[\s\S]{0,400}?'([^']+)'/.exec(server);
  if (!m) throw new Error('default allowlist not found in server.ts');
  return m[1].split(',');
};

describe('the production origin is allowed everywhere it is declared', () => {
  it('server.ts default includes the www origin real visitors use', () => {
    expect(serverDefault()).toContain(PRODUCTION_ORIGIN);
  });

  it('the Terraform resource declares it, so an apply cannot undo the fix', () => {
    // `env` is not in this resource's ignore_changes. A declared value that
    // disagrees with live is not inert — it is the next apply's instruction.
    expect(tfAllowlist()).toContain(PRODUCTION_ORIGIN);
  });

  it('the proxy setup script declares it too', () => {
    expect(proxySetup).toContain(PRODUCTION_ORIGIN);
  });

  it('server.ts and Terraform agree exactly, in order', () => {
    // They can drift apart silently: one is the deployed default, the other is
    // what an apply writes. Order matters because of the fallback below.
    expect(serverDefault()).toEqual(tfAllowlist());
  });
});

describe('the fallback origin names the real site', () => {
  it('server.ts falls back to the first entry for an unlisted origin', () => {
    // Pinning the mechanism, because the ordering assertion below only matters
    // while this is how the fallback works.
    expect(server).toContain('ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]');
  });

  it.each([
    ['server.ts', serverDefault],
    ['cloud-run.tf', tfAllowlist],
  ])('%s lists the production origin first', (_name, get) => {
    // An unlisted origin receives entry [0]. That response should carry the
    // real site rather than a preview deployment host — both are rejected by
    // the browser, but only one is comprehensible in a console error.
    expect(get()[0]).toBe(PRODUCTION_ORIGIN);
  });

  it('still lists the apex, which redirects to www but is reachable directly', () => {
    expect(serverDefault()).toContain('https://iampatterson.com');
  });
});
