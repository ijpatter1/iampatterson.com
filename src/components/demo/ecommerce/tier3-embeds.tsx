import Link from 'next/link';

import { LiveEmbedFrame } from '@/components/demo/ecommerce/live-embed-frame';
import { METABASE_BASE_URL, type ConfirmationEmbedUrls } from '@/lib/metabase/embed';

interface Tier3EmbedsProps {
  urls: ConfirmationEmbedUrls | null;
  orderTotal: number;
}

function hasFiniteOrderTotal(orderTotal: number): boolean {
  return Number.isFinite(orderTotal) && orderTotal > 0;
}

function buildFrames(orderTotal: number) {
  return [
    {
      key: 'dailyRevenue' as const,
      title: 'Daily revenue trend (30 days)',
      caption: "Today's revenue. Orders like yours roll into this bar as they complete.",
    },
    {
      key: 'funnel' as const,
      title: 'Funnel conversion by channel',
      caption: 'You just converted. Out of every 100 visitors from your channel, about 3 get here.',
    },
    {
      key: 'aov' as const,
      title: 'AOV trend (90 days)',
      caption: hasFiniteOrderTotal(orderTotal)
        ? `Your order was $${orderTotal.toFixed(2)}. Here's where it lands on the 90-day AOV trend.`
        : 'Your order against the 90-day AOV trend.',
    },
  ];
}

function SectionHeader({ urls }: { urls: ConfirmationEmbedUrls | null }) {
  return (
    <div className="mb-6 border-t border-neutral-200 pt-10">
      <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
        Tier 3 · Business Intelligence
      </div>
      <h2
        id="tier3-heading"
        className="mt-2 font-display font-normal text-neutral-900"
        style={{ fontSize: 'clamp(28px, 4vw, 44px)', lineHeight: '1.05' }}
      >
        What your order just did in the dashboards.
      </h2>
      <p className="mt-3 max-w-[60ch] text-sm leading-relaxed text-neutral-600">
        {urls ? (
          <>
            This isn&apos;t a screenshot. Each chart below is a live Metabase iframe, signed fresh
            on page load, querying the same BigQuery mart tables your order just wrote into.
          </>
        ) : (
          <>
            The Tier 3 payoff is three live Metabase iframes, signed fresh on page load against the
            same BigQuery mart tables your order wrote into. They&apos;re deployed — this
            environment just isn&apos;t wired to mint the JWTs. See them directly in Metabase below.
          </>
        )}
      </p>
    </div>
  );
}

export function Tier3Embeds({ urls, orderTotal }: Tier3EmbedsProps) {
  const frames = buildFrames(orderTotal);

  return (
    <section aria-labelledby="tier3-heading" className="mx-auto max-w-4xl px-5 pb-20 md:px-10">
      <SectionHeader urls={urls} />

      {urls ? (
        frames.map(({ key, title, caption }) => (
          <figure key={key} className="mt-10" data-testid={`tier3-frame-${key}`}>
            <figcaption className="mb-2 text-sm italic text-neutral-600">{caption}</figcaption>
            <LiveEmbedFrame src={urls[key]} title={title} />
          </figure>
        ))
      ) : (
        <div
          data-testid="tier3-fallback"
          className="mt-10 rounded border border-dashed border-neutral-300 bg-neutral-50 p-6"
        >
          <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
            Live embeds offline
          </div>
          <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-neutral-600">
            The link below opens the full dashboard on the IAP-gated Metabase instance. If
            you&apos;re not allowlisted, you&apos;ll hit the Google SSO wall — reach out for a
            walkthrough.
          </p>
          <Link
            href={`${METABASE_BASE_URL}/dashboard/2`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block text-sm text-neutral-900 underline underline-offset-4 hover:text-neutral-700"
          >
            Open the full dashboard at bi.iampatterson.com ↗
          </Link>
        </div>
      )}
    </section>
  );
}
