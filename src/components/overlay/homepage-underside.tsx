/**
 * Homepage-specific "underside" content for the Tier 1 showcase.
 * Rendered as the default view when the under-the-hood view opens from the homepage.
 * Shows consent management, live event stream, and pipeline architecture.
 */
export function HomepageUnderside() {
  return (
    <div className="space-y-12">
      <div>
        <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-accent-current">
          Tier 1 · running under your session
        </div>
        <h2 className="font-display text-2xl font-normal leading-tight text-u-ink sm:text-3xl">
          Every page on this site is <em className="text-accent-current">instrumented</em> with the
          same foundation I build for clients.
        </h2>
        <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-u-ink-2">
          Here&apos;s what&apos;s running right now, underneath your session — consent management,
          the live event stream, and the pipeline architecture. One session, three systems, no
          mocks.
        </p>
      </div>

      {/* Consent Management */}
      <section className="border border-u-rule-soft bg-u-paper-alt p-6">
        <div className="mb-4 flex items-baseline gap-3">
          <span className="font-mono text-[10px] tracking-widest text-u-ink-3">01</span>
          <h3 className="font-mono text-[11px] uppercase tracking-widest text-accent-current">
            Consent Management
          </h3>
        </div>
        <p className="text-sm leading-relaxed text-u-ink-2">
          The Cookiebot consent banner controls which tracking destinations receive your data. Your
          consent state is passed to server-side GTM via Consent Mode v2, where it determines tag
          firing and data routing in real time.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            {
              signal: 'analytics_storage',
              label: 'Analytics',
              controls: 'GA4, BigQuery event sink',
            },
            {
              signal: 'ad_storage',
              label: 'Marketing',
              controls: 'Meta CAPI, Google Ads EC',
            },
            {
              signal: 'functionality_storage',
              label: 'Preferences',
              controls: 'Personalization features',
            },
          ].map(({ signal, label, controls }) => (
            <div
              key={signal}
              className="border-l-2 border-accent-current bg-u-paper-deep px-4 py-3"
            >
              <p className="text-xs font-medium text-u-ink">{label}</p>
              <p className="mt-1 font-mono text-[10px] text-u-ink-3">{signal}</p>
              <p className="mt-2 text-xs leading-relaxed text-u-ink-2">{controls}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Live Event Stream */}
      <section className="border border-u-rule-soft bg-u-paper-alt p-6">
        <div className="mb-4 flex items-baseline gap-3">
          <span className="font-mono text-[10px] tracking-widest text-u-ink-3">02</span>
          <h3 className="font-mono text-[11px] uppercase tracking-widest text-accent-current">
            Live Event Stream
          </h3>
        </div>
        <p className="text-sm leading-relaxed text-u-ink-2">
          As you scroll, click, and navigate, events fire through the data layer and are processed
          by server-side GTM. Switch to the Timeline tab to see your session events; click any event
          there for a step-by-step walkthrough of its journey.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {['page_view', 'scroll_depth', 'click_nav', 'click_cta', 'consent_update'].map(
            (event) => (
              <span
                key={event}
                className="flex items-center gap-2 border border-u-rule-soft bg-u-paper-deep px-3 py-1.5 font-mono text-[11px] text-u-ink-2"
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-current" />
                {event}
              </span>
            ),
          )}
        </div>
      </section>

      {/* Pipeline Architecture */}
      <section className="border border-u-rule-soft bg-u-paper-alt p-6">
        <div className="mb-4 flex items-baseline gap-3">
          <span className="font-mono text-[10px] tracking-widest text-u-ink-3">03</span>
          <h3 className="font-mono text-[11px] uppercase tracking-widest text-accent-current">
            Pipeline Architecture
          </h3>
        </div>
        <p className="text-sm leading-relaxed text-u-ink-2">
          Every event follows the same path: from your browser through server-side GTM to its
          destinations. This is the same infrastructure I deploy for clients, running live on this
          site.
        </p>
        <div className="mt-5 flex items-center justify-between gap-2 overflow-x-auto">
          {[
            { label: 'Browser', detail: 'Data layer push' },
            { label: 'Client GTM', detail: 'Consent check' },
            { label: 'Server-Side GTM', detail: 'Event processing' },
            { label: 'BigQuery', detail: 'Warehouse write' },
            { label: 'Pub/Sub', detail: 'Real-time stream' },
          ].map(({ label, detail }, i, arr) => (
            <div key={label} className="flex items-center gap-2">
              <div className="min-w-0 text-center">
                <p className="text-xs font-medium text-u-ink">{label}</p>
                <p className="font-mono text-[10px] uppercase tracking-wider text-u-ink-3">
                  {detail}
                </p>
              </div>
              {i < arr.length - 1 && (
                <span className="flex-shrink-0 text-accent-current" aria-hidden="true">
                  &rarr;
                </span>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
