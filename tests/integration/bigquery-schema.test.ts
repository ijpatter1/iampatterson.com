/**
 * Verifies that the BigQuery schema.json covers all fields from the TypeScript event schema.
 * This prevents the BQ table from drifting out of sync with the data layer spec.
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

describe('BigQuery schema alignment with TypeScript event schema', () => {
  it('schema.json file exists and is valid JSON', () => {
    expect(schemaJson).toBeInstanceOf(Array);
    expect(schemaJson.length).toBeGreaterThan(0);
  });

  it('includes all BaseEvent fields', () => {
    // BaseEvent: event (→ event_name), timestamp (→ event_timestamp), session_id, page_path, page_title
    expect(bqColumnNames).toContain('event_name');
    expect(bqColumnNames).toContain('event_timestamp');
    expect(bqColumnNames).toContain('session_id');
    expect(bqColumnNames).toContain('page_path');
    expect(bqColumnNames).toContain('page_title');
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

  it('includes server-side enrichment fields', () => {
    expect(bqColumnNames).toContain('received_timestamp');
    expect(bqColumnNames).toContain('user_agent');
    expect(bqColumnNames).toContain('geo_country');
  });

  it('event-specific fields are NULLABLE', () => {
    const eventSpecificFields = [
      'page_referrer',
      'depth_percentage',
      'depth_pixels',
      'link_text',
      'link_url',
      'cta_text',
      'cta_location',
      'form_name',
      'field_name',
      'form_success',
      'consent_analytics',
      'consent_marketing',
      'consent_preferences',
    ];
    for (const field of eventSpecificFields) {
      const col = schemaJson.find((c) => c.name === field);
      expect(col?.mode).toBe('NULLABLE');
    }
  });

  it('base fields are REQUIRED', () => {
    const requiredFields = [
      'event_name',
      'event_timestamp',
      'received_timestamp',
      'session_id',
      'page_path',
      'page_title',
    ];
    for (const field of requiredFields) {
      const col = schemaJson.find((c) => c.name === field);
      expect(col?.mode).toBe('REQUIRED');
    }
  });

  it('all columns have descriptions', () => {
    for (const col of schemaJson) {
      expect(col.description).toBeTruthy();
    }
  });
});
