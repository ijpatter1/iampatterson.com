/**
 * Verifies that the BigQuery schema.json covers all fields from the TypeScript
 * event schema and aligns with sGTM's getAllEventData() output.
 *
 * The BQ raw table stores what sGTM produces. Field names match sGTM's Common
 * Event Data model and event parameters. The TypeScript schema (data layer
 * contract) uses slightly different names, Dataform staging normalizes this.
 */
import * as fs from 'fs';
import * as path from 'path';

interface BqColumn {
  name: string;
  type: string;
  mode: string;
  description: string;
}

const schemaPath = path.resolve(__dirname, '../../infrastructure/bigquery/schema.json');
const schemaJson: BqColumn[] = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
const bqColumnNames = schemaJson.map((col) => col.name);

describe('BigQuery schema alignment with sGTM event data', () => {
  it('schema.json file exists and is valid JSON', () => {
    expect(schemaJson).toBeInstanceOf(Array);
    expect(schemaJson.length).toBeGreaterThan(0);
  });

  it('includes sGTM Common Event Data fields', () => {
    expect(bqColumnNames).toContain('event_name');
    expect(bqColumnNames).toContain('page_location');
    expect(bqColumnNames).toContain('page_path');
    expect(bqColumnNames).toContain('page_title');
    expect(bqColumnNames).toContain('page_referrer');
    expect(bqColumnNames).toContain('client_id');
    expect(bqColumnNames).toContain('user_agent');
    expect(bqColumnNames).toContain('ip_override');
  });

  it('includes server-side timestamp as INT64', () => {
    const col = schemaJson.find((c) => c.name === 'received_timestamp');
    expect(col).toBeDefined();
    expect(col?.type).toBe('INT64');
    expect(col?.mode).toBe('REQUIRED');
  });

  it('includes client-side timestamp as STRING', () => {
    const col = schemaJson.find((c) => c.name === 'timestamp');
    expect(col).toBeDefined();
    expect(col?.type).toBe('STRING');
  });

  it('includes session_id event parameter', () => {
    expect(bqColumnNames).toContain('session_id');
  });

  it('includes PageViewEvent fields', () => {
    expect(bqColumnNames).toContain('page_referrer');
  });

  it('includes ScrollDepthEvent fields', () => {
    expect(bqColumnNames).toContain('depth_percentage');
    expect(bqColumnNames).toContain('depth_pixels');
  });

  it('includes ClickNavEvent fields', () => {
    expect(bqColumnNames).toContain('link_text');
    expect(bqColumnNames).toContain('link_url');
  });

  it('includes ClickCtaEvent fields', () => {
    expect(bqColumnNames).toContain('cta_text');
    expect(bqColumnNames).toContain('cta_location');
  });

  it('includes FormStartEvent fields', () => {
    expect(bqColumnNames).toContain('form_name');
  });

  it('includes FormFieldFocusEvent fields', () => {
    expect(bqColumnNames).toContain('form_name');
    expect(bqColumnNames).toContain('field_name');
  });

  it('includes FormSubmitEvent fields', () => {
    expect(bqColumnNames).toContain('form_name');
    expect(bqColumnNames).toContain('form_success');
  });

  it('includes ConsentUpdateEvent fields', () => {
    expect(bqColumnNames).toContain('consent_analytics');
    expect(bqColumnNames).toContain('consent_marketing');
    expect(bqColumnNames).toContain('consent_preferences');
  });

  it('includes Phase 9E nav & Session State discriminator fields (deliverable 9)', () => {
    // dismissal_mode (NavHintDismissedEvent), source (OverviewTabViewEvent /
    // TimelineTabViewEvent / ConsentTabViewEvent), destination
    // (PortalClickEvent), threshold (CoverageMilestoneEvent).
    // Without these columns, the sGTM "Write to BigQuery" tag silently drops the
    // discriminator values (ignoreUnknownValues: true), and BI queries can't segment
    // by dismissal mode / tab source / portal destination / coverage threshold.
    expect(bqColumnNames).toContain('dismissal_mode');
    expect(bqColumnNames).toContain('source');
    expect(bqColumnNames).toContain('destination');

    const thresholdCol = schemaJson.find((c) => c.name === 'threshold');
    expect(thresholdCol).toBeDefined();
    expect(thresholdCol?.type).toBe('INT64');
  });

  it('includes Phase 10 D1 WebVitalEvent fields (metric_name, metric_value, metric_rating, metric_id, navigation_type)', () => {
    // Without these columns, the sGTM "Write to BigQuery" tag silently drops the
    // Core Web Vitals fields (ignoreUnknownValues: true), and BI can't segment
    // CWV by metric type / rating bucket / navigation type, or dedupe on metric_id.
    expect(bqColumnNames).toContain('metric_name');
    expect(bqColumnNames).toContain('metric_rating');
    expect(bqColumnNames).toContain('metric_id');
    expect(bqColumnNames).toContain('navigation_type');

    const metricValueCol = schemaJson.find((c) => c.name === 'metric_value');
    expect(metricValueCol).toBeDefined();
    // FLOAT64 because LCP/INP/FCP/TTFB are sub-millisecond floats and CLS is a
    // unitless shift score like 0.08.
    expect(metricValueCol?.type).toBe('FLOAT64');
  });

  it('includes Phase 10d D3 PageEngagementEvent fields (engagement_seconds, max_scroll_pct)', () => {
    // Without these columns, the sGTM "Write to BigQuery" tag silently drops the
    // page_engagement payload (ignoreUnknownValues: true), and the
    // mart_ecommerce_funnel.demo_engagement_pings count fires against rows
    // whose engagement_seconds + max_scroll_pct columns are NULL — defeating
    // the analytics value of the D3 event entirely. Mirrors the WebVital
    // precedent above; the schema has to land in lock-step with the event
    // type, even though the sGTM trigger + GA4 tag wiring carries to Phase 11
    // D9 separately.
    expect(bqColumnNames).toContain('engagement_seconds');
    expect(bqColumnNames).toContain('max_scroll_pct');

    const engagementSecondsCol = schemaJson.find((c) => c.name === 'engagement_seconds');
    expect(engagementSecondsCol).toBeDefined();
    // INT64 because the threshold values are integers (15, 60, 180).
    expect(engagementSecondsCol?.type).toBe('INT64');

    const maxScrollPctCol = schemaJson.find((c) => c.name === 'max_scroll_pct');
    expect(maxScrollPctCol).toBeDefined();
    // INT64 because the percentage is rounded to whole numbers in the tracker.
    expect(maxScrollPctCol?.type).toBe('INT64');
  });

  it('only event_name and received_timestamp are REQUIRED', () => {
    const requiredCols = schemaJson.filter((c) => c.mode === 'REQUIRED');
    const requiredNames = requiredCols.map((c) => c.name).sort();
    expect(requiredNames).toEqual(['event_name', 'received_timestamp']);
  });

  it('all other fields are NULLABLE', () => {
    const nonRequired = schemaJson.filter((c) => c.mode !== 'REQUIRED');
    for (const col of nonRequired) {
      expect(col.mode).toBe('NULLABLE');
    }
  });

  it('all columns have descriptions', () => {
    for (const col of schemaJson) {
      expect(col.description).toBeTruthy();
    }
  });

  it('does not include geo fields (derived in Dataform staging)', () => {
    expect(bqColumnNames).not.toContain('geo_country');
    expect(bqColumnNames).not.toContain('geo_region');
    expect(bqColumnNames).not.toContain('geo_city');
  });
});
