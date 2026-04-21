/**
 * CSS rule-presence tests for the Session overlay's CRT boot layers.
 *
 * jsdom does not process stylesheet rules into computed style, so behavioral
 * assertions (`getComputedStyle(...).opacity`) return defaults rather than the
 * values declared in `globals.css`. Instead, this suite reads the stylesheet
 * as text and asserts that the load-bearing phase-scoped rules and the
 * transform-origin fidelity fix are present. If someone deletes or renames
 * one of these rules during a refactor, the structural tests in
 * `overlay-view.test.tsx` would still pass silently, these tests are
 * the second line of defense.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(__dirname, '../../../src/styles/globals.css'), 'utf8');

describe('globals.css, overlay CRT rules', () => {
  it('declares crt-paint-down animation on .crt-bloom during phase-boot', () => {
    // [data-phase='boot'] .crt-bloom { animation: crt-paint-down ... }
    expect(css).toMatch(
      /\[data-phase=['"]boot['"]\]\s+\.crt-bloom\s*\{[^}]*animation:\s*crt-paint-down/,
    );
  });

  it('declares the phase-on bloom fade-out (opacity transition with 80ms delay)', () => {
    // [data-phase='on'] .crt-bloom { opacity: 0; transition: opacity 200ms ease 80ms; }
    // Prototype ported rule; without it the curtain snaps off at phase transition.
    expect(css).toMatch(
      /\[data-phase=['"]on['"]\]\s+\.crt-bloom\s*\{[^}]*transition:\s*opacity\s+200ms\s+ease\s+80ms/,
    );
  });

  it('hides .tab-flash during phase-boot so panel contents stay invisible under the curtain', () => {
    // [data-phase='boot'] .tab-flash { animation: none; opacity: 0; }
    expect(css).toMatch(/\[data-phase=['"]boot['"]\]\s+\.tab-flash\s*\{[^}]*opacity:\s*0/);
  });

  it('declares the one-shot crt-flick animation on .crt-flicker during phase-boot', () => {
    expect(css).toMatch(
      /\[data-phase=['"]boot['"]\]\s+\.crt-flicker\s*\{[^}]*animation:\s*crt-flick/,
    );
  });

  it('fades scanlines in once the overlay settles to phase-on', () => {
    expect(css).toMatch(/\[data-phase=['"]on['"]\]\s+\.crt-scanlines\s*\{[^}]*opacity:\s*1/);
  });

  it('keeps the scanline stripe alpha at 0.03 to match the prototype', () => {
    // Regression guard: a prior session drifted this value to 0.05, which
    // reads brighter/louder than the prototype intends. Asserting the exact
    // value here catches silent drift on future refactors.
    const scanlineBlock = css.match(/\.crt-scanlines\s*\{[^}]*\}/s);
    expect(scanlineBlock).not.toBeNull();
    expect(scanlineBlock?.[0]).toMatch(/rgba\(\s*255,\s*164,\s*0,\s*0\.03\s*\)/);
    expect(scanlineBlock?.[0]).not.toMatch(/rgba\(\s*255,\s*164,\s*0,\s*0\.05\s*\)/);
  });

  it('hides .overlay-chrome (header + tabs) during phase-boot', () => {
    // Keeps header/tabs from painting under the curtain if it misses a frame.
    expect(css).toMatch(/\[data-phase=['"]boot['"]\]\s+\.overlay-chrome\s*\{[^}]*opacity:\s*0/);
  });

  it('declares transform-origin: top on .crt-bloom to match the prototype', () => {
    // Prototype at docs/input_artifacts/.../styles/overlay.css sets this on
    // the bloom layer; paint-down reads from the top edge. Ported for fidelity.
    expect(css).toMatch(/\.crt-bloom\s*\{[^}]*transform-origin:\s*top/);
  });
});
