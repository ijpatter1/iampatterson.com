import type { Metadata, Viewport } from 'next';

import { Header } from '@/components/header';
import { FooterSlot } from '@/components/footer-slot';
import { AmbientBubblesWrapper } from '@/components/ambient-bubbles-wrapper';
import { OverlayProvider } from '@/components/overlay/overlay-context';
import { OverlayView } from '@/components/overlay/overlay-view';
import { SessionStateProvider } from '@/components/session-state-provider';
import { PageEngagementTracker } from '@/components/page-engagement-tracker';
import { RouteTracker } from '@/components/route-tracker';
import { ScrollDepthTracker } from '@/components/scroll-depth-tracker';
import { LiveEventsProvider } from '@/components/live-events-provider';
import { CookiebotScript } from '@/components/scripts/cookiebot';
import { CookiebotConsentListener } from '@/components/scripts/cookiebot-consent';
import { GtmScript, GtmNoscript } from '@/components/scripts/gtm';
import { WebVitalsReporter } from '@/components/scripts/web-vitals-reporter';
import { instrumentSerif, plusJakarta, jetbrainsMono } from '@/lib/fonts';
import { organizationJsonLd, personJsonLd } from '@/lib/seo/json-ld';
import '@/styles/globals.css';
import { SITE_DESCRIPTION } from '@/lib/seo/site';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL('https://iampatterson.com'),
  title: {
    default: 'I am Patterson · Marketing data, measurement and AI',
    template: '%s | I am Patterson',
  },
  description: SITE_DESCRIPTION,
  applicationName: 'I am Patterson',
  authors: [{ name: 'Ian Patterson', url: 'https://iampatterson.com' }],
  creator: 'Ian Patterson',
  publisher: 'I am Patterson',
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
    siteName: 'I am Patterson',
    title: 'I am Patterson · Marketing data, measurement and AI',
    description: SITE_DESCRIPTION,
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'I am Patterson. Numbers your marketing team can count on.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'I am Patterson · Marketing data, measurement and AI',
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
        {/* Order matters. Next runs beforeInteractive scripts in render order
            and abandons the sequence if one fails to load. The inline consent
            defaults in GtmScript cannot fail; the Cookiebot loader is a
            third-party request a content blocker will fail. Defaults first. */}
        <GtmScript />
        <CookiebotScript />
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
        <PageEngagementTracker />
        <WebVitalsReporter />
        <SessionStateProvider>
          <LiveEventsProvider>
            <OverlayProvider>
              <Header />
              <div className="flex-1">{children}</div>
              <FooterSlot />
              <AmbientBubblesWrapper />
              <OverlayView />
            </OverlayProvider>
          </LiveEventsProvider>
        </SessionStateProvider>
      </body>
    </html>
  );
}
