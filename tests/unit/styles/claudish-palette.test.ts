/**
 * @jest-environment node
 *
 * Claudish translator — skin-swap palette pins (feat/claudish M2, phase E5).
 *
 * The trade-dress contingency is CSS-variable-shaped: [data-page='claudish']
 * carries two complete sibling palettes keyed by [data-skin='clone'] and
 * [data-skin='personal'], so a takedown response is an env-var flip
 * (NEXT_PUBLIC_CLAUDISH_SKIN=personal) + redeploy — no code change.
 * These pins read globals.css as text (cookiebot-override precedent):
 * both skins must declare the IDENTICAL variable set (a variable missing
 * from one skin silently falls back cross-skin — the exact bug class
 * this file exists to catch), and the personal skin must not reference
 * Roboto.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const css = readFileSync(
  path.join(process.cwd(), 'src', 'styles', 'globals.css'),
  'utf8'
);

const blockFor = (selector: string): string => {
  const start = css.indexOf(selector);
  expect(start).toBeGreaterThan(-1);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
};

const varsIn = (block: string): string[] =>
  [...block.matchAll(/--[a-z0-9-]+(?=\s*:)/g)].map((m) => m[0]).sort();

describe('claudish palette blocks', () => {
  it('declares the base scope with the font variable applied', () => {
    const base = blockFor("[data-page='claudish']");
    expect(base).toContain('var(--font-claudish-ui');
  });

  it('declares identical variable sets in both skins', () => {
    const clone = varsIn(blockFor("[data-page='claudish'][data-skin='clone']"));
    const personal = varsIn(blockFor("[data-page='claudish'][data-skin='personal']"));
    expect(clone.length).toBeGreaterThanOrEqual(14);
    expect(personal).toEqual(clone);
  });

  it('keeps Roboto out of the personal skin (the takedown re-skin)', () => {
    const personal = blockFor("[data-page='claudish'][data-skin='personal']");
    expect(personal).not.toMatch(/roboto/i);
    expect(personal).toContain('var(--font-body)');
  });

  it('never consumes the overlay --accent variable inside the claudish scope', () => {
    // OverlayProvider flips --accent on <html>; the claudish palette must
    // be immune to it (its own vars win on the descendant scope).
    const clone = blockFor("[data-page='claudish'][data-skin='clone']");
    expect(clone).not.toContain('var(--accent)');
  });
});
