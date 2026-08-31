/**
 * @jest-environment jsdom
 *
 * Claudish translator — trade-dress guard (feat/claudish M2, phase F1).
 *
 * The spec's line: faithful clone of the LAYOUT and interactions; never
 * the Google logo, wordmark, "Google" in UI/title/domain, or the
 * four-color mark. The one sanctioned occurrence is the footer
 * disclaimer ("Not affiliated with Google. Yet.") — nominative fair use,
 * mandated by the same spec. Enforced two ways: a full-tree render scan
 * and an fs scan of every claudish source file.
 */
import { render } from '@testing-library/react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

jest.mock('@/lib/claudish/client', () => ({ streamTranslation: jest.fn() }));
jest.mock('@/lib/events/track', () => ({
  trackClaudishTranslate: jest.fn(),
  trackClaudishDetected: jest.fn(),
  trackClaudishShare: jest.fn(),
  trackClaudishRate: jest.fn(),
}));

import { ClaudishApp } from '@/components/claudish/claudish-app';

const GOOGLE_BRAND_COLORS = ['#4285f4', '#ea4335', '#fbbc05', '#34a853'];

/** Comments may discuss the spoof target; executable strings may not. */
const stripComments = (code: string): string =>
  code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

describe('trade dress — rendered tree', () => {
  it('contains "Google" exactly once, in the disclaimer, and nowhere in attributes', () => {
    const { container } = render(<ClaudishApp />);
    const html = container.innerHTML;
    const occurrences = html.match(/Google/g) ?? [];
    expect(occurrences).toHaveLength(1);
    expect(html).toContain('Not affiliated with Google. Yet.');
    // Never inside any attribute value (aria-label, alt, title, data-*).
    for (const el of container.querySelectorAll('*')) {
      for (const attr of el.getAttributeNames()) {
        expect(el.getAttribute(attr) ?? '').not.toMatch(/google/i);
      }
    }
  });

  it('renders none of the four-color brand marks', () => {
    const { container } = render(<ClaudishApp />);
    const html = container.innerHTML.toLowerCase();
    for (const color of GOOGLE_BRAND_COLORS) {
      expect(html).not.toContain(color);
    }
  });
});

describe('trade dress — source scan', () => {
  const files = [
    ...walk(path.join(process.cwd(), 'src', 'components', 'claudish')),
    ...walk(path.join(process.cwd(), 'src', 'app', 'claudish')),
    ...walk(path.join(process.cwd(), 'src', 'lib', 'claudish')),
  ].filter((f) => /\.(ts|tsx|json)$/.test(f));

  it('keeps every "Google" reference out of claudish sources except the disclaimer constant', () => {
    expect(files.length).toBeGreaterThan(10);
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      const hits = text.match(/google/gi) ?? [];
      if (file.endsWith(path.join('lib', 'claudish', 'messages.ts'))) {
        // The verbatim disclaimer + its docblock mention.
        expect(text).toContain('Not affiliated with Google. Yet.');
        continue;
      }
      // Cheap proxy: no google inside string literals of any other
      // claudish file (comments stripped first — they may name the target).
      const code = stripComments(text);
      const stringLiterals = code.match(/(['"`])(?:(?!\1).)*\1/g) ?? [];
      for (const literal of stringLiterals) {
        expect(literal).not.toMatch(/google/i);
      }
      void hits;
    }
  });

  it('references no Google font hosts or logo assets anywhere in claudish sources', () => {
    for (const file of files) {
      const code = stripComments(readFileSync(file, 'utf8'));
      expect(code).not.toMatch(/fonts\.googleapis\.com/);
      expect(code).not.toMatch(/googlelogo|translate\.google/i);
      for (const color of GOOGLE_BRAND_COLORS) {
        expect(code.toLowerCase()).not.toContain(color);
      }
    }
  });
});
