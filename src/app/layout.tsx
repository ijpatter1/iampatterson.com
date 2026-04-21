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
      <head>
        <CookiebotScript />
        <GtmScript />
      </head>
      <body className="flex min-h-screen flex-col bg-surface text-content font-sans antialiased">
        <GtmNoscript />
        <CookiebotConsentListener />
        <RouteTracker />
        <ScrollDepthTracker />
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
