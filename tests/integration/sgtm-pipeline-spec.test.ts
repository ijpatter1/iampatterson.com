/**
 * Verifies the sGTM server container spec includes all Phase 2
 * real-time pipeline configuration.
 */
import * as fs from 'fs';
import * as path from 'path';

const specPath = path.resolve(__dirname, '../../infrastructure/gtm/server-container.json');
const spec = JSON.parse(fs.readFileSync(specPath, 'utf-8'));

describe('sGTM server container spec — Phase 2 pipeline', () => {
  it('has a Pub/Sub tag in the main tags array', () => {
    const pubsubTag = spec.tags.find(
      (t: Record<string, unknown>) => typeof t.name === 'string' && t.name.includes('Pub/Sub'),
    );
    expect(pubsubTag).toBeDefined();
    expect(pubsubTag.name).toBe('Pub/Sub - Publish All Events');
  });

  it('Pub/Sub tag fires on All GA4 Events trigger', () => {
    const pubsubTag = spec.tags.find(
      (t: Record<string, unknown>) => typeof t.name === 'string' && t.name.includes('Pub/Sub'),
    );
    expect(pubsubTag.firingTrigger).toBe('All GA4 Events');
  });

  it('Pub/Sub tag targets the correct topic', () => {
    const pubsubTag = spec.tags.find(
      (t: Record<string, unknown>) => typeof t.name === 'string' && t.name.includes('Pub/Sub'),
    );
    expect(pubsubTag.configuration.topicName).toContain('iampatterson-events');
  });

  it('Pub/Sub tag message payload includes session_id', () => {
    const pubsubTag = spec.tags.find(
      (t: Record<string, unknown>) => typeof t.name === 'string' && t.name.includes('Pub/Sub'),
    );
    const fields = pubsubTag.configuration.messagePayload.fields;
    expect(fields.session_id).toBeDefined();
  });

  it('Pub/Sub tag message payload includes consent state', () => {
    const pubsubTag = spec.tags.find(
      (t: Record<string, unknown>) => typeof t.name === 'string' && t.name.includes('Pub/Sub'),
    );
    const consent = pubsubTag.configuration.messagePayload.fields.consent;
    expect(consent.analytics_storage).toBeDefined();
    expect(consent.ad_storage).toBeDefined();
    expect(consent.ad_user_data).toBeDefined();
    expect(consent.ad_personalization).toBeDefined();
    expect(consent.functionality_storage).toBeDefined();
  });

  it('Pub/Sub tag message payload includes routing array', () => {
    const pubsubTag = spec.tags.find(
      (t: Record<string, unknown>) => typeof t.name === 'string' && t.name.includes('Pub/Sub'),
    );
    const fields = pubsubTag.configuration.messagePayload.fields;
    expect(fields.routing).toBeDefined();
  });

  it('Pub/Sub tag fires regardless of consent state', () => {
    const pubsubTag = spec.tags.find(
      (t: Record<string, unknown>) => typeof t.name === 'string' && t.name.includes('Pub/Sub'),
    );
    expect(pubsubTag.consentRequirement).toContain('none');
  });

  it('spec still includes all Phase 1 tags', () => {
    const tagNames = spec.tags.map((t: Record<string, string>) => t.name);
    expect(tagNames).toContain('GA4 - Forwarding');
    expect(tagNames).toContain('BigQuery - Write All Events');
    expect(tagNames).toContain('Pub/Sub - Publish All Events');
  });
});
