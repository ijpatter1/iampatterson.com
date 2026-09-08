/**
 * The reconciler CLI's argument handling (Phase 14, deliverable 14.1).
 *
 * The orchestration is tested in gtm-reconcile-core.test.ts against a fake
 * client. What is left here is the part an operator touches under pressure:
 * whether a mistyped or bare invocation can write anything. Every default is
 * the safe one, and that is asserted rather than assumed.
 */
import { parseArgs, CONTAINERS, ACCOUNT_ID } from '../../../infrastructure/gtm/reconcile.js';

describe('parseArgs', () => {
  it('defaults to a read-only dry run over both containers', () => {
    expect(parseArgs([])).toEqual({
      containers: ['web', 'server'],
      apply: false,
      allowDeletes: false,
      publish: false,
      capture: false,
    });
  });

  it('turns on exactly what is named and nothing else', () => {
    // A write also needs an explicit --container (finding 2, below), so these
    // name one.
    expect(parseArgs(['--apply', '--container=web'])).toMatchObject({
      apply: true,
      allowDeletes: false,
      publish: false,
    });
    expect(parseArgs(['--apply', '--container=web', '--allow-deletes'])).toMatchObject({
      apply: true,
      allowDeletes: true,
      publish: false,
    });
  });

  it('selects one container or both', () => {
    expect(parseArgs(['--container=web']).containers).toEqual(['web']);
    expect(parseArgs(['--container=server']).containers).toEqual(['server']);
    expect(parseArgs(['--container=both']).containers).toEqual(['web', 'server']);
  });

  it('refuses a container name it does not know rather than silently doing both', () => {
    // Silently widening a typo to "both" would apply to a container the
    // operator did not name.
    expect(() => parseArgs(['--container=webb'])).toThrow(/unknown container "webb"/);
  });

  it('refuses an unknown flag rather than ignoring it', () => {
    // --allowdeletes or --dry-run would otherwise read as accepted and do
    // something other than what was meant.
    expect(() => parseArgs(['--allowdeletes'])).toThrow(/unknown flag/);
    expect(() => parseArgs(['--dry-run'])).toThrow(/unknown flag/);
  });

  it('refuses --publish without --apply', () => {
    // Publishing what a dry run did not write would create a version from
    // whatever happened to be sitting in the workspace.
    expect(() => parseArgs(['--publish'])).toThrow(/requires --apply/);
  });
});

describe('container identity', () => {
  it('pins the account and container ids the census confirmed live', () => {
    expect(ACCOUNT_ID).toBe('6346433751');
    expect(CONTAINERS.web.id).toBe('247511905');
    expect(CONTAINERS.server.id).toBe('247531845');
  });
});

describe('review finding 2 — the server container is opt-in', () => {
  // The 2026-09-08 census concluded that server-container.json describes a
  // container that was planned and never built, and "must not be reconciled
  // from this spec". Nothing enforced it: --apply defaulted to both
  // containers, and the server spec passes pre-flight because its community
  // template type strings fall through normalizeType and none are gaawe. A
  // bare `node reconcile.js --apply` would have created nine triggers and five
  // malformed tags alongside the working Stape ones.
  it('defaults a read to both containers, since reading is harmless', () => {
    expect(parseArgs([]).containers).toEqual(['web', 'server']);
  });

  it('refuses to write to the server container without naming it', () => {
    expect(() => parseArgs(['--apply'])).toThrow(/--container/);
    expect(() => parseArgs(['--apply', '--container=both'])).toThrow(/--container/);
  });

  it('allows a write when the container is named explicitly', () => {
    expect(parseArgs(['--apply', '--container=web']).containers).toEqual(['web']);
    expect(parseArgs(['--apply', '--container=server']).containers).toEqual(['server']);
  });

  it('refuses a capture of both at once, which would rewrite two specs lossily', () => {
    // Finding 8: capture drops top-level keys the spec has and every note.
    expect(() => parseArgs(['--capture'])).toThrow(/--container/);
    expect(parseArgs(['--capture', '--container=server']).containers).toEqual(['server']);
  });
});
