/**
 * The Node 24 verification is a script, not a card: it checks every surface
 * the acceptance names and writes the record itself (Ian, 2026-09-04: no
 * human-in-the-loop theatre for anything a machine can verify).
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const scriptPath = path.join(__dirname, '..', '..', '..', 'scripts', 'verify-node24.sh');
const script = readFileSync(scriptPath, 'utf8');

describe('scripts/verify-node24.sh', () => {
  it('is executable', () => {
    expect(statSync(scriptPath).mode & 0o111).not.toBe(0);
  });

  it('covers every surface the 12.1 acceptance names', () => {
    for (const marker of ['engines', 'node_major_from_dockerfile', 'Dockerfile stages', 'node -v', 'npm test', 'run-claudish-golden.sh', 'fell through', 'vercel', 'Node.js version 20.x is deprecated', 'gcloud builds log', '/health', '/translate', 'deploy-cloud-run.sh diff', 'sync-dataform']) {
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

  it('hardcodes no Node major anywhere it makes a decision', () => {
    // Measured on the pre-change script: the literal 24 was live on EIGHT lines
    // — four assertions (engines.node, the Dockerfile stage grep, @types/node,
    // the Cloud Build log grep), one evidence label, and three non-assertion
    // surfaces (the Homebrew PATH export, the output filename, the report
    // header). Two files, counting this test. Earlier drafts of this comment
    // said four, six, and "five files"; eight/two is what `git show` reports.
    expect(script).toContain('node_major_from_dockerfile');
    // Shape, not value. An earlier revision asserted the absence of the strings
    // 'node:24-slim' and '[ "$TMAJ" = "24" ]' — every one of which contains 24,
    // so hardcoding 26 after a migration left this green. That is the same
    // source-text pin this PR retires, one value later.
    expect(script).not.toMatch(/node:\d+-slim/);
    expect(script).not.toMatch(/\[ "\$TMAJ" = "\d+" \]/);
    expect(script).not.toMatch(/= "\d+\.x" \]/);
    expect(script).not.toMatch(/node@\d+\/bin/);
  });

  describe('the derivation refuses to run rather than comparing nothing to nothing', () => {
    // These exercise the script, not its text. Every case below exits inside the
    // derivation block at the top — well above `npm test` and every gcloud call
    // — so running them costs a bash startup.
    const repo = (dockerfiles: Record<string, string>, withLib = true) => {
      const root = mkdtempSync(path.join(tmpdir(), 'node24-'));
      mkdirSync(path.join(root, 'scripts', 'lib'), { recursive: true });
      copyFileSync(scriptPath, path.join(root, 'scripts', 'verify-node24.sh'));
      if (withLib) {
        copyFileSync(
          path.join(__dirname, '..', '..', '..', 'scripts', 'lib', 'node-major.sh'),
          path.join(root, 'scripts', 'lib', 'node-major.sh'),
        );
      }
      for (const [svc, body] of Object.entries(dockerfiles)) {
        mkdirSync(path.join(root, 'infrastructure', 'cloud-run', svc), { recursive: true });
        writeFileSync(path.join(root, 'infrastructure', 'cloud-run', svc, 'Dockerfile'), body);
      }
      return root;
    };
    const run = (root: string): { code: number; err: string } => {
      try {
        execFileSync('bash', ['scripts/verify-node24.sh'], { cwd: root, encoding: 'utf8', stdio: 'pipe' });
        return { code: 0, err: '' };
      } catch (e) {
        const x = e as { status?: number; stderr?: string };
        return { code: x.status ?? 1, err: x.stderr ?? '' };
      }
    };
    const three = (a: string, b: string, c: string) => ({
      'event-stream': a,
      'data-generator': b,
      'claudish-proxy': c,
    });
    const ok = 'FROM node:24-slim AS builder\nFROM node:24-slim AS final\n';

    it('stops when a Dockerfile yields no major, instead of passing checks vacuously', () => {
      // The regression this guards: an empty NMAJ made both sides of every later
      // comparison empty, and `[ "" = "" ]` succeeds — so engines.node, the local
      // toolchain and all three @types/node rows recorded PASS in the durable
      // record exactly when the derivation was broken.
      const { code, err } = run(repo(three('FROM ubuntu:22.04\n', ok, ok)));
      expect(code).toBe(1);
      expect(err).toContain('could not derive a Node major');
    });

    it('stops when the services disagree, and names the service that differs', () => {
      const { code, err } = run(repo(three(ok, ok, 'FROM node:20-slim AS builder\nFROM node:20-slim AS final\n')));
      expect(code).toBe(1);
      expect(err).toContain('disagree');
      expect(err).toContain('claudish-proxy');
    });

    it('stops when the helper cannot be sourced, which `set -uo pipefail` alone does not', () => {
      // Without -e, a failed `.` returns 127 and execution CONTINUES with every
      // helper undefined. Both sides of each comparison then come from the same
      // missing function, so the vacuous-pass path above reopens.
      const { code, err } = run(repo(three(ok, ok, ok), false));
      expect(code).toBe(1);
      expect(err).toContain('cannot source lib/node-major.sh');
    });
  });

  describe('scripts/lib/node-major.sh', () => {
    // Behaviour, not source text. The previous version asserted the script
    // contained `cut -d. -f1` and `[ "$TMAJ" = "24" ]`, which could not fail
    // when the logic changed — only when the characters did (Rule 8).
    const lib = path.join(__dirname, '..', '..', '..', 'scripts', 'lib', 'node-major.sh');
    const call = (fn: string, arg: string): string =>
      execFileSync('bash', ['-c', `. "${lib}"; ${fn} "$1"`, '_', arg], { encoding: 'utf8' }).trim();

    it.each([
      ['^24.13.3', '24'],
      ['~24.13.3', '24'],
      ['>=24.0.0', '24'],
      ['24.x', '24'],
      ['v24.20.0', '24'],
      ['^26.5.0', '26'],
    ])('major_of_range(%s) is %s', (range, want) => {
      expect(call('major_of_range', range)).toBe(want);
    });

    it('major_of_range yields nothing for an absent range, so the caller fails rather than matching', () => {
      expect(call('major_of_range', '')).toBe('');
    });

    it.each([
      ['FROM node:24-slim AS builder', '24'],
      ['from node:20-slim AS tools', '20'],
      ['   FROM node:22-slim', '22'],
      ['FROM node:24.13.3-slim', '24'],
      ['FROM node:24-bookworm-slim', '24'],
      // Both of these yielded EMPTY before review: the regex required a `.` or
      // `-` after the digits and no flag args. Empty then compared equal to any
      // other absent value, so the caller reported a false green.
      ['FROM node:24', '24'],
      ['FROM --platform=linux/amd64 node:24-slim', '24'],
    ])('node_major_from_dockerfile reads %s', (line, want) => {
      const tmp = path.join(mkdtempSync(path.join(tmpdir(), 'nodemajor-')), 'Dockerfile');
      writeFileSync(tmp, `${line}\n`);
      expect(call('node_major_from_dockerfile', tmp)).toBe(want);
    });

    it('reads stages Docker accepts that a ^FROM matcher skipped', () => {
      // `l.startsWith('FROM ')` discarded lowercase and indented FROM lines.
      // Stated precisely, because an earlier draft of this comment overstated
      // it: the shell check was `n=$(grep -c ...); [ "$n" = "2" ]`, so a skipped
      // line gave n=0 or 1 and the check FAILED — noisily, and blaming the wrong
      // thing. The silent-green variant needs a `>=` floor, which is what
      // runtime-currency.test.ts had until it was fixed alongside this.
      const tmp = path.join(mkdtempSync(path.join(tmpdir(), 'nodemajor-')), 'Dockerfile');
      writeFileSync(tmp, 'from node:20-slim AS tools\nFROM node:24-slim\n');
      expect(call('node_major_from_dockerfile', tmp)).toBe('20');
    });
  });
});
