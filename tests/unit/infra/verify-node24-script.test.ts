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
    for (const marker of ['engines', 'node:24-slim', 'node -v', 'vercel', 'Node.js version 20.x is deprecated', 'gcloud builds log', '/health', '/translate']) {
      expect(script).toContain(marker);
    }
  });

  it('writes its record under docs/verification and fails on any failed check', () => {
    expect(script).toContain('docs/verification/');
    expect(script).toMatch(/\[ "\$FAIL" -eq 0 \]\s*$/);
  });
});
