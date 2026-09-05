/**
 * Dependency update process (Phase 13, 13.3).
 *
 * Two things are pinned: that Dependabot watches every surface that can rot,
 * and that the cadence document carries the parts a bot cannot — the reviewer,
 * the schedule, and the two images nothing watches automatically.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');

const config = read('.github/dependabot.yml');
const cadence = read('docs/runbook/dependency-cadence.md');

/** Directories declared under a given ecosystem, read from the raw YAML. */
const dirsFor = (ecosystem: string): string[] =>
  config
    .split(/- package-ecosystem:/)
    .slice(1)
    .filter((block) => block.trimStart().startsWith(ecosystem))
    .map((block) => /directory:\s*(\S+)/.exec(block)?.[1] ?? '')
    .filter(Boolean);

describe('.github/dependabot.yml', () => {
  it('watches every package.json in the repository, not just the ones the deliverable listed', () => {
    // The deliverable says "the root and the three services". infrastructure/dataform
    // is a fourth that ships nothing but would still rot unwatched.
    const npm = dirsFor('npm').sort();
    expect(npm).toEqual(
      [
        '/',
        '/infrastructure/cloud-run/claudish-proxy',
        '/infrastructure/cloud-run/data-generator',
        '/infrastructure/cloud-run/event-stream',
        '/infrastructure/dataform',
      ].sort(),
    );
    // Every watched directory actually has a manifest.
    for (const d of npm) expect(existsSync(path.join(root, d.slice(1), 'package.json'))).toBe(true);
  });

  it('watches the base image of each service, which is the surface that produced the Node 20 deadline', () => {
    const docker = dirsFor('docker').sort();
    expect(docker).toEqual([
      '/infrastructure/cloud-run/claudish-proxy',
      '/infrastructure/cloud-run/data-generator',
      '/infrastructure/cloud-run/event-stream',
    ]);
    for (const d of docker) expect(existsSync(path.join(root, d.slice(1), 'Dockerfile'))).toBe(true);
  });

  it('watches the workflows', () => {
    expect(dirsFor('github-actions')).toEqual(['/']);
  });

  it('never groups a base-image bump with anything else', () => {
    // A runtime change deserves its own pull request and its own redeploy.
    const dockerBlocks = config
      .split(/- package-ecosystem:/)
      .slice(1)
      .filter((b) => b.trimStart().startsWith('docker'));
    expect(dockerBlocks).toHaveLength(3);
    for (const b of dockerBlocks) expect(b).not.toContain('groups:');
  });

  it('keeps Next and React in one group, because a bump to one alone cannot pass', () => {
    expect(config).toMatch(/next-react:/);
    for (const pkg of ['next', 'react', 'react-dom', 'eslint-config-next']) {
      expect(config).toContain(`'${pkg}'`);
    }
  });

  it('caps open pull requests, because a solo reviewer bulk-merges a flood', () => {
    expect(config).toMatch(/open-pull-requests-limit: [123]\b/);
    expect(config).not.toMatch(/interval: (daily|weekly)/);
  });
});

describe('docs/runbook/dependency-cadence.md', () => {
  it('names the reviewer and the schedule, which is the acceptance clause', () => {
    expect(cadence).toMatch(/\*\*Reviewer:\*\* Ian Patterson/);
    expect(cadence).toMatch(/first Monday of each month/);
  });

  it('carries a row for every surface the deliverable names', () => {
    for (const surface of [
      'Node runtime',
      'Next.js and React',
      'Cloud Run base images',
      'gtm-cloud-image',
      'Metabase',
      'Security advisories',
      'GitHub Actions',
    ]) {
      expect(cadence).toContain(surface);
    }
  });

  it('keeps the Metabase baseline the spec named, and points at the existing release-notes gate', () => {
    expect(cadence).toContain('v0.59.6');
    expect(cadence).toContain('infrastructure/metabase/upgrade.sh');
  });

  it('carries the monthly platform-notices step and the reason it exists', () => {
    // The Node 20 deadline arrived through a dashboard notice, not a bump.
    expect(cadence).toContain('Read the platform notices');
    expect(cadence).toContain('2026-10-01');
  });

  it('names the two surfaces no bot watches', () => {
    // Both are pinned images consumed by Cloud Run services, which Dependabot
    // does not see. If either stops being hand-checked it rots invisibly.
    const unwatched = cadence.match(/\*\*Nobody\. Check it by hand\.\*\*/g) ?? [];
    expect(unwatched).toHaveLength(2);
  });

  it('records the measured baseline rather than describing the process in the abstract', () => {
    expect(cadence).toMatch(/32 advisories: 14 high/);
    expect(cadence).toMatch(/first scheduled action for this cadence is the `next` advisory/);
  });
});
