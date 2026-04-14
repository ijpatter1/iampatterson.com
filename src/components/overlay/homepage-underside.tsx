/**
 * Homepage-specific "underside" content for the Tier 1 showcase.
 * Rendered as the default view when the under-the-hood view opens from the homepage.
 * Shows consent management, live event stream, and pipeline architecture.
 */
export function HomepageUnderside() {
  return (
    <div className="space-y-12">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-content sm:text-2xl">
          Tier 1 in Action
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-content-secondary">
          Every page on this site is instrumented with the same measurement foundation I build for
          clients. Here&apos;s what&apos;s running right now, underneath your session.
        </p>
      </div>

      {/* Consent Management */}
      <section className="rounded-card border border-border p-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-content-muted">
          Consent Management
        </h3>
        <p className="text-sm leading-relaxed text-content-secondary">
          The Cookiebot consent banner controls which tracking destinations receive your data. Your
          consent state is passed to server-side GTM via Consent Mode v2, where it determines tag
          firing and data routing in real time.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
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
            <div key={signal} className="rounded-lg border border-border-subtle bg-surface-alt p-3">
              <p className="text-xs font-medium text-content">{label}</p>
              <p className="mt-0.5 font-mono text-xs text-content-muted">{signal}</p>
              <p className="mt-2 text-xs text-content-secondary">{controls}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Live Event Stream */}
      <section className="rounded-card border border-border p-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-content-muted">
          Live Event Stream
        </h3>
        <p className="text-sm leading-relaxed text-content-secondary">
          As you scroll, click, and navigate, events fire through the data layer and are processed
          by server-side GTM. Switch to the Timeline tab to see your session&apos;s events in real
          time, or the Narrative tab for a step-by-step walkthrough of each event&apos;s journey.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {['page_view', 'scroll_depth', 'click_nav', 'click_cta', 'consent_update'].map(
            (event) => (
              <span
                key={event}
                className="rounded-full border border-border bg-surface px-3 py-1 font-mono text-xs text-content-secondary"
              >
                {event}
              </span>
            ),
          )}
        </div>
      </section>

      {/* Pipeline Architecture */}
      <section className="rounded-card border border-border p-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-content-muted">
          Pipeline Architecture
        </h3>
        <p className="text-sm leading-relaxed text-content-secondary">
          Every event follows the same path: from your browser through server-side GTM to its
          destinations. This is the same infrastructure I deploy for clients, running live on this
          site.
        </p>
        <div className="mt-4 flex items-center justify-between gap-2 overflow-x-auto">
          {[
            { label: 'Browser', detail: 'Data layer push' },
            { label: 'Client GTM', detail: 'Consent check' },
            { label: 'Server-Side GTM', detail: 'Event processing' },
            { label: 'BigQuery', detail: 'Warehouse write' },
            { label: 'Pub/Sub', detail: 'Real-time stream' },
          ].map(({ label, detail }, i, arr) => (
            <div key={label} className="flex items-center gap-2">
              <div className="min-w-0 text-center">
                <p className="text-xs font-medium text-content">{label}</p>
                <p className="text-xs text-content-muted">{detail}</p>
              </div>
              {i < arr.length - 1 && (
                <span className="flex-shrink-0 text-content-muted" aria-hidden="true">
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
