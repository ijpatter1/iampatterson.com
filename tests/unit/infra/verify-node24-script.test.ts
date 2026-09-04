/**
 * The Node 24 verification is a script, not a card: it checks every surface
 * the acceptance names and writes the record itself (Ian, 2026-09-04: no
 * human-in-the-loop theatre for anything a machine can verify).
 */
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const scriptPath = path.join(__dirname, '..', '..', '..', 'scripts', 'verify-node24.sh');
const script = readFileSync(scriptPath, 'utf8');

describe('scripts/verify-node24.sh', () => {
  it('is executable', () => {
    expect(statSync(scriptPath).mode & 0o111).not.toBe(0);
  });

  it('covers every surface the 12.1 acceptance names', () => {
    for (const marker of ['engines', 'node:24-slim', 'node -v', 'npm test', 'run-claudish-golden.sh', 'fell through', 'vercel', 'Node.js version 20.x is deprecated', 'gcloud builds log', '/health', '/translate', 'deploy-cloud-run.sh diff', 'sync-dataform']) {
      expect(script).toContain(marker);
    }
  });

  it('writes its record under docs/verification and fails on any failed check', () => {
    expect(script).toContain('docs/verification/');
    expect(script).toMatch(/\[ "\$FAIL" -eq 0 \]\s*$/);
  });

  it('resolves every service URL from gcloud and defines the serving revision as the one carrying traffic', () => {
    expect(script).not.toContain('https://claudish-proxy-');
    expect(script).not.toContain('status.traffic[0].revisionName');
    expect(script).toContain('x.get("percent")');
  });

  it('lets exit codes decide the suite rows, guards the digest lookup and anchors the drift grep', () => {
    expect(script).toContain('RC=$?');
    expect(script).toContain('[ "$GRC" -eq 0 ]');
    expect(script).toContain('[ -n "$REV" ] && [ -n "$IMG" ]');
    expect(script).toContain('0 field\\(s\\) differ besides the digest');
    expect(script).toContain('[ -f "$WF" ]');
    expect(script).toContain('@types/node');
  });

  it('compares the @types/node major number rather than glob-matching a caret prefix', () => {
    // [[ "$TN" == ^24.* ]] is a literal-prefix glob, not a regex: it passes
    // "^24.13.3" but reports "~24.13.3" or ">=24.0.0" as off major 24.
    expect(script).not.toMatch(/==\s*\^24\./);
    expect(script).toContain("cut -d. -f1");
    expect(script).toContain('[ "$TMAJ" = "24" ]');
  });
});
