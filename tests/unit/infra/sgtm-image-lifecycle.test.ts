/**
 * sGTM container image lifecycle (Phase 13, 13.2).
 *
 * The operator script and the decision behind it. The decision is that a
 * floating tag on Cloud Run is not floating — the revision pins the digest at
 * creation — so the configuration should pin it visibly instead.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');

const script = read('infrastructure/sgtm/update-image.sh');
const runbook = read('docs/runbook/sgtm-image-update.md');
const architecture = read('docs/ARCHITECTURE.md');

describe('infrastructure/sgtm/update-image.sh', () => {
  it('reads the running digest from the revision, not from the service spec', () => {
    // The spec is the thing that lies: it says :stable while the revision holds
    // whatever :stable meant months ago. Reading the spec would report every
    // service as current forever.
    expect(script).toContain('status.imageDigest');
    expect(script).toContain('latestReadyRevisionName');
  });

  it('honours --dry-run in any position', () => {
    expect(script).toMatch(/while \[ \$# -gt 0 \]/);
    expect(script).toMatch(/--dry-run\)\s*DRY=1/);
  });

  it('puts preview first in the service order, so production is never the rehearsal', () => {
    expect(script).toMatch(/SERVICES=\(sgtm-preview sgtm\)/);
  });

  it('health-checks either side of the deploy and refuses to call a failure a success', () => {
    expect(script).toContain('(before)');
    expect(script).toContain('(after)');
    expect(script).toMatch(/if \[ "\$after" != "200" \]/);
    expect(script).toMatch(/exit 2/);
  });

  it('prints a rollback command carrying the digest it replaced', () => {
    // A rollback instruction without the old digest is not a rollback
    // instruction; the operator would have to go find it mid-incident.
    expect(script).toMatch(/Roll back with/);
    expect(script).toMatch(/--image=\$IMAGE@\$run/);
  });

  it('rejects an unknown service rather than deploying something unexpected', () => {
    expect(script).toContain('unknown service:');
  });
});

describe('the pin is implemented, not merely decided', () => {
  const tf = read('infrastructure/terraform/cloud-run.tf');

  it('declares both sGTM images by digest rather than by the :stable tag', () => {
    // A tag in a service spec is re-resolved by ANY `gcloud run services
    // update`, so it silently carries the image forward during unrelated
    // changes. That is not hypothetical: it happened on 2026-09-05.
    expect(tf).not.toContain('gtm-cloud-image:stable"');
    const digests = tf.match(/gtm-cloud-image@sha256:[0-9a-f]{64}/g) ?? [];
    expect(digests).toHaveLength(2);
    expect(new Set(digests).size).toBe(1);
  });
});

describe('the script reads what is serving, not what is newest', () => {
  it('resolves the serving revision from the traffic target', () => {
    // latestReadyRevisionName is the wrong field when traffic is pinned, which
    // deploy-cloud-run.sh promote does by design — it would report a stale
    // service as current, blinding the tool to its own subject.
    //
    // Comments are stripped before the absence check: the script explains why it
    // avoids that field, and the explanation names it. Asserting over raw source
    // would fail on the documentation of the very fix being pinned.
    const code = script
      .split('\n')
      .filter((l) => !/^\s*#/.test(l))
      .join('\n');
    expect(code).toContain('status.traffic[0].revisionName');
    expect(code).not.toContain('latestReadyRevisionName');
  });

  it('confirms the serving digest changed after a deploy, not just health', () => {
    // `gcloud run deploy` creates a revision without moving traffic on a pinned
    // service, so the old revision answers 200 and the update reads as success.
    expect(script).toMatch(/is still serving .*not the digest just deployed/);
  });

  it('fails loudly when the state cannot be read, rather than reporting current', () => {
    // Empty compares equal to empty: without this, expired credentials make
    // every service report `current`. Credentials expire hourly here.
    expect(script).toContain('UNKNOWN');
    expect(script).toMatch(/could not resolve .* check credentials/);
  });

  it('refuses to deploy without a rollback target', () => {
    expect(script).toMatch(/refusing to deploy without a rollback target/);
  });
});

describe('the decision is recorded where a reader will find it', () => {
  it('ARCHITECTURE states the pin decision and the measurement behind it', () => {
    expect(architecture).toContain('sGTM container lifecycle: pin the digest');
    // The measurement is the argument; without the dates it is just a preference.
    expect(architecture).toContain('2026-04-03');
    expect(architecture).toMatch(/sha256:0f47d392/);
  });

  it('the runbook entry names its rollback and how you know it worked', () => {
    expect(runbook).toMatch(/## If it goes wrong/);
    expect(runbook).toMatch(/## How you know it worked/);
    expect(runbook).toContain('io.iampatterson.com/healthy');
  });

  it('the runbook records how production actually got upgraded', () => {
    // This assertion previously pinned "still on the 2026-04-03 digest", to fail
    // if production moved without the note being rewritten. Production moved —
    // by accident, on 2026-09-05, when a --max-instances change re-resolved the
    // :stable tag — and the assertion did its job. It now pins the account of
    // that, because the mechanism is the argument for the pin.
    expect(runbook).toContain('by accident');
    expect(runbook).toContain('sgtm-00015-kdj');
    expect(runbook).not.toContain('still on the 2026-04-03 digest');
  });
});
