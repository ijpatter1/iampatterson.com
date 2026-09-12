/**
 * Dependency update process (Phase 13, 13.3).
 *
 * Two things are pinned: that Dependabot watches every surface that can rot,
 * and that the cadence document carries the parts a bot cannot — the reviewer,
 * the schedule, and the two images nothing watches automatically.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

import yaml from 'js-yaml';

const root = path.join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');

const config = read('.github/dependabot.yml');

interface DependabotGroup {
  patterns?: string[];
  'dependency-type'?: string;
  'update-types'?: string[];
}

interface DependabotUpdate {
  'package-ecosystem': string;
  directory: string;
  'open-pull-requests-limit'?: number;
  groups?: Record<string, DependabotGroup>;
  ignore?: unknown[];
}

/**
 * Parsed, not string-matched. An earlier draft tested `dependency-name:\s*typescript`
 * against the raw YAML, which a later `typescript-eslint` entry would have satisfied
 * while the guard it existed to provide had quietly gone.
 */
const parsed = yaml.load(config) as { updates: DependabotUpdate[] };
const updatesFor = (ecosystem: string): DependabotUpdate[] =>
  parsed.updates.filter((u) => u['package-ecosystem'] === ecosystem);

/** The three Cloud Run services — derived from the path, not listed. */
const serviceUpdates = (): DependabotUpdate[] =>
  updatesFor('npm').filter((u) => u.directory.startsWith('/infrastructure/cloud-run/'));

/** First group whose patterns match a package name; `'*'` matches anything. */
const groupFor = (groups: Record<string, DependabotGroup>, pkg: string): string | undefined =>
  Object.entries(groups).find(([, g]) => (g.patterns ?? []).some((p) => p === pkg || p === '*'))?.[0];

const keepsMajors = (g: DependabotGroup | undefined): boolean => {
  const levels = g?.['update-types'];
  return !Array.isArray(levels) || levels.includes('major');
};
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

  it('keeps majors out of the service wildcard groups, and inside every companion group', () => {
    // #68: the event-stream group carried express 5, jest 30 and typescript 7
    // together, typescript 7 cannot be installed there, and `npm ci` died on
    // ERESOLVE before a test ran — so the express and jest bumps in the same
    // pull request could not be judged either (run 34483981686).
    //
    // The rule is derived from each group's own patterns rather than a list of
    // names: a wildcard group can bundle anything, so it takes no majors; a
    // named companion group exists precisely to keep a major together, so it
    // must keep them.
    let checked = 0;
    for (const update of serviceUpdates()) {
      const groups = update.groups ?? {};
      expect([update.directory, Object.keys(groups).length > 1]).toEqual([update.directory, true]);
      for (const [name, group] of Object.entries(groups)) {
        const wildcard = (group.patterns ?? []).includes('*');
        // Paired with the location so a red names the group it failed on.
        expect([update.directory, name, keepsMajors(group)]).toEqual([
          update.directory,
          name,
          !wildcard,
        ]);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(9);
  });

  it('never separates a runtime package from its @types companion', () => {
    // `express` 5 without `@types/express` 5 is a half-migration; `@types/express`
    // 5 against express-4 handlers is a build error. Neither pull request can
    // pass alone — the same failure the next-react group exists to prevent, one
    // entry down. Splitting majors out of the wildcard group reintroduces it
    // unless each pair has a group of its own.
    //
    // Derived entirely from the manifests, so a new runtime/@types pair added to
    // a service without a matching group reddens this without anyone editing the
    // test.
    let pairs = 0;
    for (const update of serviceUpdates()) {
      const groups = update.groups ?? {};
      const manifest = JSON.parse(read(path.join(update.directory.slice(1), 'package.json')));
      const declared: Record<string, string> = {
        ...(manifest.dependencies ?? {}),
        ...(manifest.devDependencies ?? {}),
      };
      for (const name of Object.keys(declared)) {
        if (!name.startsWith('@types/')) continue;
        const runtime = name.slice('@types/'.length);
        if (!(runtime in declared)) continue; // @types/node has no runtime here
        const typesGroup = groupFor(groups, name);
        const runtimeGroup = groupFor(groups, runtime);
        const together =
          typesGroup !== undefined && typesGroup === runtimeGroup && keepsMajors(groups[typesGroup]);
        expect([update.directory, `${runtime} + ${name}`, together]).toEqual([
          update.directory,
          `${runtime} + ${name}`,
          true,
        ]);
        pairs += 1;
      }
    }
    // Guards the loop itself: a manifest rename must not turn this green by
    // finding nothing to check.
    expect(pairs).toBeGreaterThanOrEqual(8);
  });

  it('carries no `ignore` anywhere, so a blocked update opens red instead of vanishing', () => {
    // Deliberately narrower than "hides nothing": `open-pull-requests-limit` is a
    // second route to the same outcome and is checked separately below. What this
    // pins is that no update is suppressed by name — a block we cannot take yet
    // is recorded under "Blocked" in docs/runbook/dependency-cadence.md and stays
    // visible as a red pull request.
    const suppressed = parsed.updates
      .filter((u) => u.ignore)
      .map((u) => `${u['package-ecosystem']} ${u.directory}`);
    expect(suppressed).toEqual([]);
  });

  it('keeps Next and React in one group, because a bump to one alone cannot pass', () => {
    expect(config).toMatch(/next-react:/);
    for (const pkg of ['next', 'react', 'react-dom', 'eslint-config-next']) {
      expect(config).toContain(`'${pkg}'`);
    }
  });

  it('caps open pull requests low enough to review, high enough not to suppress silently', () => {
    // The cap is a review budget — a solo reviewer bulk-merges a flood. It is
    // also the second way this config can hide an update: past the cap Dependabot
    // opens nothing at all, with no pull request and no red, which is the same
    // outcome as an `ignore` by a different route.
    //
    // The floor is derived: one slot per declared group, plus one for a major
    // that left a restricted group. An earlier draft of this file pinned the cap
    // at `[123]`, which would have made raising it to fit the split turn this
    // test red — a test forbidding the fix its neighbour demands.
    for (const update of updatesFor('npm')) {
      const limit = update['open-pull-requests-limit'] ?? 0;
      const floor = Object.keys(update.groups ?? {}).length + 1;
      expect([update.directory, limit >= floor, limit <= 10]).toEqual([
        update.directory,
        true,
        true,
      ]);
    }
    expect(config).not.toMatch(/interval: (daily|weekly)/);
  });
});

describe('docs/runbook/dependency-cadence.md', () => {
  it('names the reviewer and the schedule, which is the acceptance clause', () => {
    expect(cadence).toMatch(/\*\*Reviewer:\*\* Ian Patterson/);
    // "First Monday" was wrong and this assertion certified it: `schedule.day`
    // applies only to weekly intervals, so a monthly schedule runs on the first
    // of the month. The doc and the config now agree with the machinery.
    expect(cadence).toMatch(/\*\*first of each month\*\*/);
    expect(cadence).not.toMatch(/the first Monday of each month, Dependabot opens/);
  });

  it('carries no `day:` key, which Dependabot ignores on a monthly interval', () => {
    expect(config).not.toMatch(/^\s*day:/m);
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

  it('keeps the Metabase baseline at the live version, and points at the existing release-notes gate', () => {
    // v0.59.6 was exploited through CVE-2026-72898; production moved to v0.59.31 on 2026-09-11.
    expect(cadence).toContain('Baseline **v0.59.31**');
    expect(cadence).toContain('infrastructure/metabase/upgrade.sh');
  });

  it('carries the monthly platform-notices step and the reason it exists', () => {
    // The Node 20 deadline arrived through a dashboard notice, not a bump.
    expect(cadence).toContain('Read the platform notices');
    expect(cadence).toContain('2026-10-01');
  });

  it('carries the blocked list and an escape hatch for the cap, because an unwritten hold is one nobody lifts', () => {
    expect(cadence).toContain('## Blocked');
    // A release condition has to be runnable. "When upstream catches up" is not
    // something an operator can act on, so each row carries the command — and at
    // root the standalone package is the wrong thing to check, because the cap
    // arrives transitively through eslint-config-next.
    expect(cadence).toMatch(/npm ls @typescript-eslint\/parser/);
    // The monthly pass has to read the list, and has to have a way of seeing what
    // `open-pull-requests-limit` swallowed — the second suppression route, which
    // the config test deliberately does not cover.
    expect(cadence).toMatch(/\*\*Check the blocked list\*\*/);
    expect(cadence).toMatch(/\*\*Run `npm outdated`\*\*/);
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
