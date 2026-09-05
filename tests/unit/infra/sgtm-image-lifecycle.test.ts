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

  it('the runbook is honest that production is still behind', () => {
    // 13.2 rehearsed on preview only. If someone later updates production, this
    // assertion should fail and force the note to be rewritten rather than left
    // quietly stale.
    expect(runbook).toContain('still on the 2026-04-03 digest');
  });
});
