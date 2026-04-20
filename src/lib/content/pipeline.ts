/**
 * Pipeline-section content schema for the homepage's progressive bleed-
 * through reveal (Phase 9E D5). Mirrors the `PIPELINE_STAGES` constant in
 * docs/input_artifacts/design_handoff_pipeline/app/data.js, but with the
 * real production identifiers in place of the prototype's mock fields:
 *
 *   - sGTM hostname is the self-hosted Cloud Run endpoint (io.iampatterson.com).
 *   - BigQuery dataset.table is iampatterson_raw.events_raw, the live raw sink.
 *   - GA4 measurement ID is the real G-9M2G3RLHWF.
 *   - Client-side GTM container ID is the real GTM-N5JJ7VT4.
 *
 * Runtime-varying readouts (rows-today counts, query rates, latency
 * numbers) are illustrative — the schematic is editorial, not a live
 * dashboard. The live event log below the schematic carries the real
 * per-session data via `useLiveEvents`.
 */

export interface PipelineStageRead {
  /** Mono label (snake_case) — short identifier displayed in dt. */
  k: string;
  /** Value displayed in dd — short, single-line, mono. */
  v: string;
}

export interface PipelineStage {
  /** Stable identifier — used as React key and data-testid suffix. */
  key: 'browser' | 'cgtm' | 'sgtm' | 'bq' | 'dash';
  /** Display numeral, zero-padded to two digits. */
  n: string;
  /** Stage title — Instrument Serif headline. */
  title: string;
  /** Role label — small mono caps above the title. */
  role: string;
  /** Tech identifier — container ID, hostname, dataset.table, etc. */
  tech: string;
  /** Sub-line — short mono caps under the tech line (region, layer, etc). */
  sub: string;
  /** Short prose detail — one-line description of what happens at this stage. */
  detail: string;
  /** Inline readouts displayed in the right column on desktop, collapsed under the stage on mobile. */
  reads: PipelineStageRead[];
}

export const PIPELINE_STAGES: readonly PipelineStage[] = Object.freeze([
  {
    key: 'browser',
    n: '01',
    title: 'Browser',
    role: 'Source',
    tech: 'GTM-N5JJ7VT4',
    sub: 'client container',
    detail: 'dataLayer.push()',
    reads: [
      { k: 'session_id', v: 'ses_x9b2…' },
      { k: 'client_id', v: 'GA1.1.482…' },
      { k: 'page_path', v: '/' },
    ],
  },
  {
    key: 'cgtm',
    n: '02',
    title: 'Client GTM',
    role: 'Consent gate',
    tech: 'GTM-N5JJ7VT4',
    sub: 'web container',
    detail: 'consent check · enrich',
    reads: [
      { k: 'consent_mode', v: 'v2' },
      { k: 'analytics_storage', v: 'granted' },
      { k: 'ad_storage', v: 'denied' },
    ],
  },
  {
    key: 'sgtm',
    n: '03',
    title: 'Server GTM',
    role: 'Processor',
    tech: 'io.iampatterson.com',
    sub: 'cloud run · us-central1',
    detail: 'enrich · route · redact',
    reads: [
      { k: 'ip_override', v: 'hashed' },
      { k: 'user_agent', v: 'normalized' },
      { k: 'latency_ms', v: '38' },
    ],
  },
  {
    key: 'bq',
    n: '04',
    title: 'BigQuery',
    role: 'Warehouse',
    tech: 'iampatterson_raw.events_raw',
    sub: 'us-central1 · streaming',
    detail: 'streaming insert',
    reads: [
      { k: 'dataset', v: 'iampatterson_raw' },
      { k: 'table', v: 'events_raw' },
      { k: 'rows_today', v: '14,287' },
    ],
  },
  {
    key: 'dash',
    n: '05',
    title: 'Dashboards',
    role: 'Consumption',
    tech: 'metabase + dataform',
    sub: 'self-serve layer',
    detail: 'Dataform marts',
    reads: [
      { k: 'marts', v: 'sessions · attribution · ltv' },
      { k: 'refresh', v: 'streaming · 60s' },
      { k: 'queries', v: '2,417 / day' },
    ],
  },
]);
