/**
 * Pipeline-section content schema for the homepage's progressive bleed-
 * through reveal (Phase 9E D5, simplified in F6 UAT close-out).
 *
 * F6 rewrite: dropped the dense instrument-panel `tech` / `sub` / `reads`
 * fields in favor of an editorial `detail` one-liner under each stage
 * title. The pipeline-section on paper reads as editorial prose; the
 * dense metadata surface lived in the overlay all along (Timeline tab
 * event-detail + routing destinations, Consent tab, Overview tab header).
 * The editorial/instrument clash UAT flagged is the symptom; the density
 * mismatch was the cause.
 *
 * Identifier anchors kept where they earn their keep in the prose
 * (e.g. `iampatterson_raw.events_raw` on Stage 04, load-bearing proof
 * of "events land in a real warehouse"). Other container IDs and the
 * sGTM subdomain removed, the surrounding prose carries the weight.
 */

export interface PipelineStage {
  /** Stable identifier, used as React key and data-testid suffix. */
  key: 'browser' | 'cgtm' | 'sgtm' | 'bq' | 'dash';
  /** Display numeral, zero-padded to two digits. */
  n: string;
  /** Stage title, Instrument Serif headline. */
  title: string;
  /** Role label, small mono caps above the title. */
  role: string;
  /** Editorial one-liner under the title, carries the stage's substance. */
  detail: string;
}

export const PIPELINE_STAGES: readonly PipelineStage[] = Object.freeze([
  {
    key: 'browser',
    n: '01',
    title: 'Browser',
    role: 'Source',
    detail: '`dataLayer.push()` every click, scroll, and pageview into the web container.',
  },
  {
    key: 'cgtm',
    n: '02',
    title: 'Client GTM',
    role: 'Consent gate',
    detail: 'Consent Mode v2 decides what leaves the browser.',
  },
  {
    key: 'sgtm',
    n: '03',
    title: 'Server GTM',
    role: 'Processor',
    detail:
      'Self-hosted sGTM on Cloud Run, enriches payloads, hashes PII, fans out to GA4, BigQuery, Meta CAPI, and Google Ads.',
  },
  {
    key: 'bq',
    n: '04',
    title: 'BigQuery',
    role: 'Warehouse',
    detail: 'Streaming inserts land in `iampatterson_raw.events_raw` within seconds.',
  },
  {
    key: 'dash',
    n: '05',
    title: 'Dashboards',
    role: 'Consumption',
    detail:
      'Dataform transforms the raw table into session, attribution, and LTV marts; Metabase serves them.',
  },
]);
