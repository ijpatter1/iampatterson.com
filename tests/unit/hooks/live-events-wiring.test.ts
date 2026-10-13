/**
 * The live event source is opened in exactly one place, and that place passes
 * the visitor's analytics consent.
 *
 * Two bugs are guarded here, and both only reproduce where
 * NEXT_PUBLIC_EVENT_STREAM_URL is set, which is production.
 *
 * 1. One connection per session. The stream service keeps a single connection
 *    for a session and ends the previous one when another arrives. Two
 *    components that each open the stream take the feed from each other. So
 *    `useLiveEventsSource` (and `useEventStream` under it) may be called only
 *    by `LiveEventsProvider`; everything else reads the shared result through
 *    `useLiveEvents()`.
 *
 * 2. Consent before source. The source sits behind a sticky latch, and the
 *    consent gate exempts exactly one tag, so a declining visitor's single
 *    `consent_update` reaches the server, latches the source to the stream,
 *    and every later event is discarded. The one place that opens the source
 *    must pass `analyticsConsent`.
 *
 * A source-level pin is the honest instrument: every consumer suite mocks the
 * hook, which is what makes a behavioural test blind to both.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const PROVIDER = 'src/components/live-events-provider.tsx';
const HOOK = 'src/hooks/useLiveEvents.ts';

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), rel), 'utf8');
}

function sourceFiles(): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(path.join(process.cwd(), dir))) {
      const rel = `${dir}/${entry}`;
      if (statSync(path.join(process.cwd(), rel)).isDirectory()) walk(rel);
      else if (/\.tsx?$/.test(entry)) found.push(rel);
    }
  };
  ['src/components', 'src/hooks', 'src/app'].forEach(walk);
  return found;
}

/** Calls only: a mention in a comment or an import line is not a call. */
function calls(rel: string, name: string): boolean {
  const code = read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  return new RegExp(`\\b${name}\\s*\\(`).test(code.replace(/^\s*(import|export)\b.*$/gm, ''));
}

describe('the live event source is opened once', () => {
  it('is opened by the provider, with analytics consent', () => {
    const src = read(PROVIDER);
    expect(src).toMatch(/useLiveEventsSource\(\s*\{[^}]*analyticsConsent[^}]*\}\s*\)/);
    // The bare form is the consent bug.
    expect(src).not.toMatch(/useLiveEventsSource\(\s*\)/);
  });

  it('is opened nowhere else', () => {
    const openers = sourceFiles().filter(
      (rel) => rel !== HOOK && rel !== PROVIDER && calls(rel, 'useLiveEventsSource'),
    );
    expect(openers).toEqual([]);
  });

  it('has no component or hook opening the stream directly', () => {
    const direct = sourceFiles().filter(
      (rel) =>
        rel !== HOOK && rel !== 'src/hooks/useEventStream.ts' && calls(rel, 'useEventStream'),
    );
    expect(direct).toEqual([]);
  });

  it('is mounted once, in the root layout, inside the session state provider', () => {
    const layout = read('src/app/layout.tsx');
    expect(layout.match(/<LiveEventsProvider>/g)).toHaveLength(1);
    const session = layout.indexOf('<SessionStateProvider>');
    const live = layout.indexOf('<LiveEventsProvider>');
    const sessionEnd = layout.indexOf('</SessionStateProvider>');
    expect(session).toBeGreaterThan(-1);
    expect(live).toBeGreaterThan(session);
    expect(live).toBeLessThan(sessionEnd);
    const mounts = sourceFiles().filter(
      (rel) =>
        rel !== 'src/app/layout.tsx' && rel !== HOOK && /<LiveEventsProvider\b/.test(read(rel)),
    );
    expect(mounts).toEqual([]);
  });

  // A reader outside the provider throws, and there is no error boundary, so
  // moving the header or the overlay out of it would take down every route.
  it('encloses the header, the page and the overlay', () => {
    const layout = read('src/app/layout.tsx');
    const inside = layout.slice(
      layout.indexOf('<LiveEventsProvider>'),
      layout.indexOf('</LiveEventsProvider>'),
    );
    for (const child of ['<Header', '{children}', '<OverlayView']) {
      expect([child, inside.includes(child)]).toEqual([child, true]);
    }
  });

  // The pinned list of readers. A new reader is fine, but it is added here on
  // purpose, and each one takes no options: consent is resolved once, where
  // the source is opened.
  it('is read by exactly these consumers, through the shared hook', () => {
    const readers = sourceFiles().filter((rel) => rel !== HOOK && calls(rel, 'useLiveEvents'));
    expect(readers.sort()).toEqual(
      [
        'src/components/chrome/live-strip.tsx',
        'src/components/home/pipeline-editorial.tsx',
        'src/components/home/proof-panel.tsx',
        'src/components/overlay/overlay-view.tsx',
        'src/hooks/useSessionContext.ts',
        'src/hooks/useSessionReadout.ts',
      ].sort(),
    );
    for (const rel of readers) {
      expect([rel, /useLiveEvents\(\s*\)/.test(read(rel))]).toEqual([rel, true]);
    }
  });
});
