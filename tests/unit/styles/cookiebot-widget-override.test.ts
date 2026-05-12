/**
 * UAT r3 B1 regression pin: the Cookiebot consent widget is
 * positioned bottom-right via a CSS override in `globals.css`,
 * because Cookiebot's loader writes inline `left: …px` on its
 * `#CookiebotWidget` container by default. The Consent tab
 * directive copy in `src/components/overlay/consent-view.tsx`
 * tells visitors the widget lives in the "bottom-right corner";
 * if the CSS rule is dropped during a future global-stylesheet
 * refactor, the copy becomes a lie with no test failing.
 *
 * This file-level fs read pins the rule's presence so a stylesheet
 * cleanup that strips it fails red at CI time.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Cookiebot widget bottom-right override (UAT r3 B1)', () => {
  const globalsCssPath = resolve(__dirname, '../../../src/styles/globals.css');
  const globalsCss = readFileSync(globalsCssPath, 'utf8');

  it('declares a `#CookiebotWidget` selector', () => {
    expect(globalsCss).toMatch(/#CookiebotWidget\b/);
  });

  it('sets `right: 20px` and `left: auto` with `!important` so Cookiebot inline-style writes lose', () => {
    // Single rule block, both declarations carry !important. Regex
    // tolerates whitespace + property order variation but pins the
    // values + override mechanism.
    const ruleBlock = globalsCss.match(/#CookiebotWidget\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(ruleBlock).toMatch(/left:\s*auto\s*!important/);
    expect(ruleBlock).toMatch(/right:\s*20px\s*!important/);
  });
});
