import type { Metadata, Viewport } from 'next';

import { Header } from '@/components/header';
import { FooterSlot } from '@/components/footer-slot';
import { AmbientBubblesWrapper } from '@/components/ambient-bubbles-wrapper';
import { OverlayProvider } from '@/components/overlay/overlay-context';
import { OverlayView } from '@/components/overlay/overlay-view';
import { SessionStateProvider } from '@/components/session-state-provider';
import { RouteTracker } from '@/components/route-tracker';
import { ScrollDepthTracker } from '@/components/scroll-depth-tracker';
import { CookiebotScript } from '@/components/scripts/cookiebot';
import { CookiebotConsentListener } from '@/components/scripts/cookiebot-consent';
import { GtmScript, GtmNoscript } from '@/components/scripts/gtm';
import { WebVitalsReporter } from '@/components/scripts/web-vitals-reporter';
import { instrumentSerif, plusJakarta, jetbrainsMono } from '@/lib/fonts';
import '@/styles/globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: {
    default: 'Patterson Consulting',
    template: '%s | Patterson Consulting',
  },
  description: 'Measurement infrastructure for marketing teams that need to trust their data.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${instrumentSerif.variable} ${plusJakarta.variable} ${jetbrainsMono.variable}`}
    >
      {/*
       * `suppressHydrationWarning` on <head> is the React-documented escape hatch for
       * third-party scripts that modify the DOM before hydration. Cookiebot's
       * `data-blockingmode="auto"` injects child <script> tags into <head> during
       * its own bootstrap (the consentcdn.cookiebot.com/consentconfig/<cbid> URL),
       * which rewrites the head DOM out from under React. Without this, every page
       * load logs a hydration mismatch on the Cookiebot loader and the GTM
       * consent-defaults block. Suppression is one level deep — it covers the
       * direct script-tag children of <head> without affecting any other surface
       * on the page.
       */}
      <head suppressHydrationWarning>
        <CookiebotScript />
        <GtmScript />
      </head>
      <body className="flex min-h-screen flex-col bg-surface text-content font-sans antialiased">
        <GtmNoscript />
        <CookiebotConsentListener />
        <RouteTracker />
        <ScrollDepthTracker />
        <WebVitalsReporter />
        <SessionStateProvider>
          <OverlayProvider>
            <Header />
            <div className="flex-1">{children}</div>
            <FooterSlot />
            <AmbientBubblesWrapper />
            <OverlayView />
          </OverlayProvider>
        </SessionStateProvider>
      </body>
    </html>
  );
}
