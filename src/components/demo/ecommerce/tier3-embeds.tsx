import type { ConfirmationEmbedUrls } from '@/lib/metabase/embed';

interface Tier3EmbedsProps {
  urls: ConfirmationEmbedUrls;
}

const FRAMES = [
  {
    key: 'dailyRevenue' as const,
    title: 'Daily revenue trend (30 days)',
    caption: "Today's revenue. Your order is in there.",
  },
  {
    key: 'funnel' as const,
    title: 'Funnel conversion by channel',
    caption: 'You just converted. Out of every 100 visitors from your channel, about 3 get here.',
  },
  {
    key: 'aov' as const,
    title: 'AOV trend (90 days)',
    caption: 'Your order against the 90-day AOV trend.',
  },
];

export function Tier3Embeds({ urls }: Tier3EmbedsProps) {
  return (
    <section aria-labelledby="tier3-heading" className="mx-auto max-w-4xl px-5 pb-20 md:px-10">
      <div className="mb-6 border-t border-neutral-200 pt-10">
        <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
          Tier 3 · Business Intelligence
        </div>
        <h2 id="tier3-heading" className="mt-2 text-2xl font-semibold text-neutral-900">
          What your order just did in the dashboards.
        </h2>
        <p className="mt-3 max-w-[60ch] text-sm leading-relaxed text-neutral-600">
          This isn&apos;t a screenshot. Each chart below is a live Metabase iframe, signed fresh on
          page load, querying the same BigQuery mart tables your order just wrote into.
        </p>
      </div>

      {FRAMES.map(({ key, title, caption }) => (
        <figure key={key} className="mt-10">
          <figcaption className="mb-2 text-sm italic text-neutral-600">{caption}</figcaption>
          <div className="overflow-hidden rounded border border-neutral-200">
            <iframe
              src={urls[key]}
              title={title}
              loading="lazy"
              className="h-[420px] w-full"
              style={{ border: 0 }}
            />
          </div>
        </figure>
      ))}
    </section>
  );
}
