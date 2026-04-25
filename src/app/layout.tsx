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
import { organizationJsonLd, personJsonLd } from '@/lib/seo/json-ld';
import '@/styles/globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

const SITE_DESCRIPTION =
  'Measurement infrastructure for marketing teams that need to trust their data.';

export const metadata: Metadata = {
  metadataBase: new URL('https://iampatterson.com'),
  title: {
    default: 'Patterson Consulting',
    template: '%s | Patterson Consulting',
  },
  description: SITE_DESCRIPTION,
  applicationName: 'Patterson Consulting',
  authors: [{ name: 'Ian Patterson', url: 'https://iampatterson.com' }],
  creator: 'Ian Patterson',
  publisher: 'Patterson Consulting',
  keywords: [
    'marketing measurement',
    'server-side tagging',
    'sGTM',
    'BigQuery',
    'Dataform',
    'GA4',
    'consulting',
    'marketing analytics',
  ],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://iampatterson.com',
    siteName: 'Patterson Consulting',
    title: 'Patterson Consulting',
    description: SITE_DESCRIPTION,
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'Patterson Consulting — measurement infrastructure',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Patterson Consulting',
    description: SITE_DESCRIPTION,
    images: ['/opengraph-image'],
  },
  alternates: {
    canonical: 'https://iampatterson.com',
  },
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
        {/* JSON-LD structured data — Organization + Person. Inlined as
            two separate <script type="application/ld+json"> tags so
            Google's rich-results parser sees both schemas independently
            (a single graph wrapper would also work; two scripts is the
            simpler shape and is widely-supported). */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd()) }}
        />
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
