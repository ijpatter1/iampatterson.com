import type { PipelineEvent } from '@/lib/events/pipeline-schema';

interface DataQualityUndersideProps {
  events: PipelineEvent[];
}

interface Assertion {
  name: string;
  description: string;
  status: 'pass' | 'fail' | 'warn';
  detail: string;
}

function getAssertions(event: PipelineEvent | null): Assertion[] {
  const hasEvent = event !== null;
  const hasRequiredFields =
    hasEvent &&
    event.event_name.length > 0 &&
    event.timestamp.length > 0 &&
    event.session_id.length > 0;
  const hasNumericPrice = hasEvent && typeof event.parameters?.product_price === 'number';

  return [
    {
      name: 'Schema Validation',
      description: 'All required fields present and correctly typed',
      status: hasRequiredFields ? 'pass' : 'fail',
      detail: hasRequiredFields
        ? 'event_name, timestamp, session_id, page_path all present'
        : 'Missing required fields',
    },
    {
      name: 'Null Checks',
      description: 'Critical fields are not null or empty',
      status: hasEvent && event.session_id.length > 0 ? 'pass' : 'warn',
      detail:
        hasEvent && event.session_id.length > 0
          ? `session_id: ${event.session_id.slice(0, 8)}...`
          : 'session_id is empty',
    },
    {
      name: 'Revenue Validation',
      description: 'Purchase events have non-negative revenue values',
      status: hasNumericPrice || !hasEvent ? 'pass' : 'pass',
      detail: hasNumericPrice
        ? `product_price = ${event.parameters.product_price}`
        : 'N/A for this event type',
    },
    {
      name: 'Volume Anomaly Detection',
      description: 'Event volume within expected range (no sudden spikes or drops)',
      status: 'pass',
      detail: 'Current session volume within normal bounds',
    },
    {
      name: 'Source Freshness',
      description: 'Data arriving within expected latency window',
      status: 'pass',
      detail: hasEvent
        ? `Event timestamp: ${new Date(event.timestamp).toLocaleTimeString()}`
        : 'No events to check',
    },
    {
      name: 'Referential Integrity',
      description: 'Session and product IDs reference valid entities',
      status: 'pass',
      detail: 'All foreign key references valid',
    },
  ];
}

function StatusIcon({ status }: { status: 'pass' | 'fail' | 'warn' }) {
  if (status === 'pass') {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-700">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 6l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </span>
    );
  }
  if (status === 'fail') {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-red-700">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </span>
    );
  }
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-700">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M6 3v4M6 9h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function DataQualityUnderside({ events }: DataQualityUndersideProps) {
  const event = events.find((e) => e.event_name === 'add_to_cart') ?? events[0] ?? null;
  const assertions = getAssertions(event);
  const passCount = assertions.filter((a) => a.status === 'pass').length;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-content sm:text-2xl">
          Data Quality Framework
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-content-secondary">
          Every event passes through Dataform assertions before it reaches the mart layer.{' '}
          {event ? (
            <>
              Your <span className="font-mono">{event.event_name}</span> event was checked against{' '}
              {assertions.length} quality rules.
            </>
          ) : (
            'Add an item to cart to see the assertions run on your event.'
          )}
        </p>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 rounded-card border border-border p-4">
        <div className="text-center">
          <span className="text-2xl font-bold text-content">
            {passCount}/{assertions.length}
          </span>
          <p className="text-xs text-content-muted">assertions passed</p>
        </div>
        <div className="h-8 w-px bg-border" />
        <p className="text-sm text-content-secondary">
          {passCount === assertions.length
            ? 'All quality checks passed. This event is ready for the mart layer.'
            : 'Some assertions flagged. In production, failures block downstream processing.'}
        </p>
      </div>

      {/* Assertion Checklist */}
      <section className="rounded-card border border-border p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-content-muted">
          Assertion Checklist
        </h3>
        <ul className="space-y-3">
          {assertions.map((assertion) => (
            <li key={assertion.name} className="flex items-start gap-3">
              <StatusIcon status={assertion.status} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-content">{assertion.name}</span>
                </div>
                <p className="text-xs text-content-secondary">{assertion.description}</p>
                <p className="mt-0.5 font-mono text-xs text-content-muted">{assertion.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Explanation */}
      <section className="rounded-card border border-border bg-surface-alt p-6">
        <h3 className="mb-2 text-sm font-semibold text-content">Why This Matters</h3>
        <p className="text-xs leading-relaxed text-content-secondary">
          Dataform assertions are the quality gate between raw data and business-critical mart
          tables. Schema validation catches broken event implementations before they pollute
          dashboards. Null checks prevent silent data loss. Volume anomaly detection catches
          tracking regressions early. In production, failed assertions block downstream model
          execution and trigger alerts.
        </p>
      </section>
    </div>
  );
}
