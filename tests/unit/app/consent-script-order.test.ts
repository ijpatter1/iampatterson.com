import { readFileSync } from 'fs';
import { join } from 'path';

// Next.js runs `beforeInteractive` scripts one after another in the order the
// layout renders them, and abandons the rest of the sequence if one fails to
// load. The Consent Mode defaults are an inline script that cannot fail; the
// Cookiebot loader is a third-party request that a content blocker will fail.
// So the defaults have to come first: every visitor gets "denied" before GTM
// loads, whether or not Cookiebot arrives.
describe('consent script order in the root layout', () => {
  const layout = readFileSync(join(process.cwd(), 'src/app/layout.tsx'), 'utf8');

  it('renders the consent defaults ahead of the Cookiebot loader', () => {
    // Only the rendered <head>, so a mention in a comment above the JSX or an
    // import line cannot satisfy or break the order.
    const head = layout.slice(layout.indexOf('<head>'), layout.indexOf('</head>'));
    const defaults = head.search(/<GtmScript\b[^>]*\/>/);
    const cookiebot = head.search(/<CookiebotScript\b[^>]*\/>/);
    expect(defaults).toBeGreaterThan(-1);
    expect(cookiebot).toBeGreaterThan(-1);
    expect(defaults).toBeLessThan(cookiebot);
  });

  it('keeps the defaults in the same component as the GTM loader, ahead of it', () => {
    const gtm = readFileSync(join(process.cwd(), 'src/components/scripts/gtm.tsx'), 'utf8');
    expect(gtm.indexOf('id="consent-defaults"')).toBeGreaterThan(-1);
    expect(gtm.indexOf('id="consent-defaults"')).toBeLessThan(gtm.indexOf('id="gtm-script"'));
    expect(gtm).toMatch(/id="consent-defaults" strategy="beforeInteractive"/);
  });

  // The loader must stay out of the beforeInteractive sequence. Moved into it,
  // GTM would load as part of the same chain as the defaults and the Cookiebot
  // request, and "defaults first" would depend on render order inside one
  // component instead of on the loading strategy.
  it('loads GTM itself after the page is interactive', () => {
    const gtm = readFileSync(join(process.cwd(), 'src/components/scripts/gtm.tsx'), 'utf8');
    expect(gtm).toMatch(/id="gtm-script" strategy="afterInteractive"/);
  });
});
