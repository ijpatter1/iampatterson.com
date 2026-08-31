/**
 * Claudish translator — Roboto, scoped to /claudish.
 *
 * The clone's strongest cheap recognition signal. Self-hosted latin
 * subset via next/font/local (no fonts.googleapis.com request — no
 * extra RTT on a page where latency is the product, no third-party
 * call on a site whose pitch is consent hygiene). Imported ONLY from
 * the /claudish layout so the preload stays route-scoped.
 * --font-claudish-ui is one of the [data-skin] swap variables: the
 * personal re-skin sets it back to the site's body stack.
 */
import localFont from 'next/font/local';

export const robotoClone = localFont({
  src: [
    { path: '../../../public/fonts/roboto-latin-400.woff2', weight: '400', style: 'normal' },
    { path: '../../../public/fonts/roboto-latin-500.woff2', weight: '500', style: 'normal' },
  ],
  variable: '--font-claudish-roboto',
  display: 'swap',
  fallback: ['Helvetica Neue', 'Arial', 'sans-serif'],
});
