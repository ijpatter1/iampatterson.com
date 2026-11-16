/**
 * @jest-environment node
 *
 * The overlay's narrative lines read event parameters from the live stream,
 * and the stream carries only the parameters the sGTM Pub/Sub tag copies
 * (`infrastructure/gtm/pubsub-tag-template.js`, its `keys` allow-list). A
 * parameter the overlay reads but the tag drops renders as "?" or a default:
 * on 2026-11-16 every page_engagement row read "You spent ?s engaged on /
 * (scrolled 0%)" while BigQuery held the real 15/60/180 and the scroll
 * percentage. Every parameter the narrative reads must be on the allow-list.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');

const allowList = (): string[] => {
  const src = read('infrastructure/gtm/pubsub-tag-template.js');
  const block = src.match(/var keys = \[([\s\S]*?)\];/);
  if (!block) throw new Error('pubsub-tag-template.js has no `var keys = [...]` allow-list');
  // Comments are stripped first, so a key only mentioned in a comment does not count.
  const code = block[1].replace(/\/\/.*$/gm, '');
  return [...code.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]);
};

// Every overlay component, not only the narrative: a reader of `params.x`,
// `params?.x`, `params['x']` or `parameters.x` anywhere in the overlay counts.
const overlayFiles = (): string[] =>
  (readdirSync(path.join(root, 'src/components/overlay'), { recursive: true }) as string[])
    .filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f))
    .map((f) => path.join('src/components/overlay', f));

const narrativeReads = (): string[] => {
  const reads = new Set<string>();
  for (const f of overlayFiles()) {
    const src = read(f);
    for (const m of src.matchAll(/\b(?:params|parameters)(?:\?\.|\.)([A-Za-z0-9_]+)\b/g))
      reads.add(m[1]);
    for (const m of src.matchAll(/\b(?:params|parameters)\[['"]([A-Za-z0-9_]+)['"]\]/g))
      reads.add(m[1]);
  }
  return [...reads];
};

describe('the live stream carries what the overlay reads', () => {
  it('finds both lists, so an empty read is not a silent pass', () => {
    expect(allowList().length).toBeGreaterThan(10);
    expect(narrativeReads()).toEqual(
      expect.arrayContaining(['engagement_seconds', 'max_scroll_pct', 'depth_percentage']),
    );
  });

  it('every parameter the narrative reads is on the Pub/Sub tag allow-list', () => {
    const keys = allowList();
    expect(narrativeReads().filter((p) => !keys.includes(p))).toEqual([]);
  });
});
