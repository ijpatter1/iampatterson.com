import type { PipelineEvent } from '@/lib/events/pipeline-schema';

interface WarehouseWriteUndersideProps {
  events: PipelineEvent[];
}

const BQ_COLUMNS = [
  { name: 'event_name', type: 'STRING', group: 'Core' },
  { name: 'event_timestamp', type: 'TIMESTAMP', group: 'Core' },
  { name: 'event_date', type: 'DATE', group: 'Core' },
  { name: 'session_id', type: 'STRING', group: 'Core' },
  { name: 'page_path', type: 'STRING', group: 'Page' },
  { name: 'page_title', type: 'STRING', group: 'Page' },
  { name: 'page_location', type: 'STRING', group: 'Page' },
  { name: 'page_referrer', type: 'STRING', group: 'Page' },
  { name: 'consent_analytics', type: 'BOOLEAN', group: 'Consent' },
  { name: 'consent_marketing', type: 'BOOLEAN', group: 'Consent' },
  { name: 'consent_preferences', type: 'BOOLEAN', group: 'Consent' },
  { name: 'event_params', type: 'RECORD (REPEATED)', group: 'Params' },
] as const;

function PipelineStep({
  label,
  detail,
  active,
}: {
  label: string;
  detail: string;
  active: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center rounded-lg border p-3 text-center ${
        active ? 'border-black bg-neutral-50' : 'border-border bg-surface'
      }`}
    >
      <span className={`text-xs font-semibold ${active ? 'text-content' : 'text-content-muted'}`}>
        {label}
      </span>
      <span className="mt-0.5 text-xs text-content-secondary">{detail}</span>
    </div>
  );
}

export function WarehouseWriteUnderside({ events }: WarehouseWriteUndersideProps) {
  const event =
    events.find((e) => e.event_name === 'begin_checkout') ??
    events.find((e) => e.event_name === 'purchase') ??
    events[0] ??
    null;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-content sm:text-2xl">
          Warehouse Write
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-content-secondary">
          This is the moment your event lands in the warehouse. The data flows from sGTM through
          Pub/Sub and is written to the BigQuery <span className="font-mono">events_raw</span> table
          with all 51 columns.
        </p>
      </div>

      {/* Pipeline visualization */}
      <section className="rounded-card border border-border p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-content-muted">
          Write Path
        </h3>
        <div className="flex items-center gap-2 overflow-x-auto">
          <PipelineStep label="sGTM" detail="Event received" active={false} />
          <span className="text-content-muted" aria-hidden="true">
            &rarr;
          </span>
          <PipelineStep label="Pub/Sub" detail="Message queued" active={false} />
          <span className="text-content-muted" aria-hidden="true">
            &rarr;
          </span>
          <PipelineStep label="BigQuery" detail="Row written" active />
        </div>
      </section>

      {/* Row preview */}
      <section className="rounded-card border border-border p-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-content-muted">
          BigQuery Row — <span className="font-mono">events_raw</span>
        </h3>
        {event ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-2 text-xs font-semibold text-content-muted">Column</th>
                  <th className="pb-2 text-xs font-semibold text-content-muted">Type</th>
                  <th className="pb-2 text-xs font-semibold text-content-muted">Value</th>
                </tr>
              </thead>
              <tbody>
                {BQ_COLUMNS.map((col) => {
                  let value = '-';
                  if (col.name === 'event_name') value = event.event_name;
                  else if (col.name === 'event_timestamp') value = event.timestamp;
                  else if (col.name === 'event_date') value = event.timestamp.split('T')[0] ?? '-';
                  else if (col.name === 'session_id') value = `${event.session_id.slice(0, 12)}...`;
                  else if (col.name === 'page_path') value = event.page_path;
                  else if (col.name === 'page_title') value = event.page_title;
                  else if (col.name === 'page_location')
                    value =
                      event.page_location.length > 50
                        ? `${event.page_location.slice(0, 50)}...`
                        : event.page_location;
                  else if (col.name === 'consent_analytics')
                    value = String(event.consent.analytics_storage === 'granted');
                  else if (col.name === 'consent_marketing')
                    value = String(event.consent.ad_storage === 'granted');
                  else if (col.name === 'consent_preferences')
                    value = String(event.consent.functionality_storage === 'granted');
                  else if (col.name === 'event_params')
                    value = `{${Object.keys(event.parameters).length} keys}`;

                  return (
                    <tr key={col.name} className="border-b border-border-subtle last:border-0">
                      <td className="py-1.5 pr-3 font-mono text-xs text-content">{col.name}</td>
                      <td className="py-1.5 pr-3 text-xs text-content-muted">{col.type}</td>
                      <td className="py-1.5 font-mono text-xs text-content-secondary">{value}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-content-muted">
            Begin checkout to see the warehouse write for your event.
          </p>
        )}
      </section>

      {/* Table info */}
      <section className="rounded-card border border-border bg-surface-alt p-6">
        <h3 className="mb-2 text-sm font-semibold text-content">Table Details</h3>
        <div className="space-y-1 font-mono text-xs text-content-secondary">
          <p>
            Project: <span className="text-content">iampatterson</span>
          </p>
          <p>
            Dataset: <span className="text-content">iampatterson_raw</span>
          </p>
          <p>
            Table: <span className="text-content">events_raw</span>
          </p>
          <p>
            Columns: <span className="text-content">51</span>
          </p>
          <p>
            Partitioned by: <span className="text-content">event_date (DAY)</span>
          </p>
        </div>
      </section>
    </div>
  );
}
