/**
 * Verifies that the BigQuery schema.json covers all fields from the TypeScript
 * event schema and aligns with sGTM's getAllEventData() output.
 *
 * The BQ raw table stores what sGTM produces. Field names match sGTM's Common
 * Event Data model and event parameters. The TypeScript schema (data layer
 * contract) uses slightly different names — Dataform staging normalizes this.
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
    // dismissal_mode (NavHintDismissedEvent), source (SessionStateTabViewEvent),
    // destination (PortalClickEvent), threshold (CoverageMilestoneEvent).
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
