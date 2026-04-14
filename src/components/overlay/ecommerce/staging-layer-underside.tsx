import type { PipelineEvent } from '@/lib/events/pipeline-schema';

interface StagingLayerUndersideProps {
  events: PipelineEvent[];
}

function getMostRecentEvent(events: PipelineEvent[], ...names: string[]): PipelineEvent | null {
  return events.find((e) => names.includes(e.event_name)) ?? events[0] ?? null;
}

function FieldRow({
  field,
  raw,
  staged,
  transform,
}: {
  field: string;
  raw: string;
  staged: string;
  transform: string;
}) {
  return (
    <tr className="border-b border-border-subtle last:border-0">
      <td className="py-2 pr-3 font-mono text-xs text-content-muted">{field}</td>
      <td className="py-2 pr-3 font-mono text-xs text-content-secondary">{raw}</td>
      <td className="py-2 pr-3 font-mono text-xs font-medium text-content">{staged}</td>
      <td className="py-2 text-xs text-content-muted italic">{transform}</td>
    </tr>
  );
}

export function StagingLayerUnderside({ events }: StagingLayerUndersideProps) {
  const event = getMostRecentEvent(events, 'product_view', 'page_view');

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-content sm:text-2xl">
          Staging Layer
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-content-secondary">
          Your <span className="font-mono">{event?.event_name ?? 'product_view'}</span> event is
          being flattened and enriched in the staging layer. The raw event from sGTM is transformed
          into the <span className="font-mono">stg_events</span> model with standardized column
          names, extracted parameters, and session stitching.
        </p>
      </div>

      {/* Raw Event */}
      <section className="rounded-card border border-border p-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-content-muted">
          Raw Event
        </h3>
        {event ? (
          <pre className="overflow-x-auto rounded-lg bg-neutral-50 p-4 font-mono text-xs leading-relaxed text-content-secondary">
            {JSON.stringify(
              {
                event_name: event.event_name,
                timestamp: event.timestamp,
                page_path: event.page_path,
                session_id: event.session_id,
                parameters: event.parameters,
              },
              null,
              2,
            )}
          </pre>
        ) : (
          <p className="text-sm text-content-muted">
            Interact with a product to see the raw event here.
          </p>
        )}
      </section>

      {/* Arrow */}
      <div className="flex justify-center">
        <div className="flex flex-col items-center gap-1 text-content-muted">
          <span className="text-xs font-medium">Dataform stg_events</span>
          <svg
            width="20"
            height="24"
            viewBox="0 0 20 24"
            fill="none"
            className="text-content-muted"
          >
            <path d="M10 0v20M4 16l6 6 6-6" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </div>
      </div>

      {/* Staged Output */}
      <section className="rounded-card border border-border p-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-content-muted">
          stg_events Output
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-2 text-xs font-semibold text-content-muted">Field</th>
                <th className="pb-2 text-xs font-semibold text-content-muted">Raw</th>
                <th className="pb-2 text-xs font-semibold text-content-muted">Staged</th>
                <th className="pb-2 text-xs font-semibold text-content-muted">Transform</th>
              </tr>
            </thead>
            <tbody>
              <FieldRow
                field="event_name"
                raw={event?.event_name ?? '-'}
                staged={event?.event_name ?? '-'}
                transform="pass-through"
              />
              <FieldRow
                field="event_timestamp"
                raw={event?.timestamp ?? '-'}
                staged={event?.timestamp ? new Date(event.timestamp).toISOString() : '-'}
                transform="ISO 8601 normalize"
              />
              <FieldRow
                field="session_id"
                raw={event?.session_id ? `${event.session_id.slice(0, 8)}...` : '-'}
                staged={event?.session_id ? `${event.session_id.slice(0, 8)}...` : '-'}
                transform="session stitching"
              />
              <FieldRow
                field="page_path"
                raw={event?.page_path ?? '-'}
                staged={event?.page_path ?? '-'}
                transform="URL parse"
              />
              <FieldRow
                field="product_id"
                raw={String(event?.parameters?.product_id ?? '(nested)')}
                staged={String(event?.parameters?.product_id ?? '-')}
                transform="param extraction"
              />
              <FieldRow
                field="product_name"
                raw={String(event?.parameters?.product_name ?? '(nested)')}
                staged={String(event?.parameters?.product_name ?? '-')}
                transform="param extraction"
              />
              <FieldRow
                field="product_price"
                raw={String(event?.parameters?.product_price ?? '(nested)')}
                staged={String(event?.parameters?.product_price ?? '-')}
                transform="CAST to FLOAT64"
              />
            </tbody>
          </table>
        </div>
      </section>

      {/* Explanation */}
      <section className="rounded-card border border-border bg-surface-alt p-6">
        <h3 className="mb-2 text-sm font-semibold text-content">What Happens Here</h3>
        <p className="text-xs leading-relaxed text-content-secondary">
          The Dataform <span className="font-mono">stg_events</span> model flattens the nested
          event_params structure from BigQuery&apos;s raw event schema into typed, queryable
          columns. It deduplicates events, extracts product and session attributes, casts numeric
          values, and normalizes timestamps. This is the foundation every downstream mart model
          builds on.
        </p>
      </section>
    </div>
  );
}
