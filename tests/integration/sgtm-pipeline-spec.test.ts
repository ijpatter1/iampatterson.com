/**
 * The sGTM server container spec, against the container that actually exists.
 *
 * Rewritten 2026-09-08 ([14.1]). Every assertion here previously described a
 * container that was planned and never built: tags named `GA4 - Forwarding`,
 * `BigQuery - Write All Events` and `Pub/Sub - Publish All Events`, firing on a
 * trigger called `All GA4 Events`, configured through a
 * `configuration.messagePayload.fields` object. The 2026-09-08 census
 * (`docs/verification/2026-09-08-gtm-container-census.md`) measured the live
 * container: none of those names exist, and neither does that configuration
 * shape — the Tag Manager API has no such field. The tests passed because both
 * sides of the comparison were the same aspirational document.
 *
 * The spec is now captured from live, so these assert the real thing. What they
 * check is unchanged in spirit: every event reaches Pub/Sub and BigQuery
 * through one generic route, and the two couplings that would break the
 * pipeline silently — the topic path and the table id — are pinned.
 *
 * WHAT MOVED, AND WHERE IT WENT: the message payload assertions (session_id,
 * consent state, the routing array) were checking a structure the container
 * never held. That payload is built by the custom template's own code in
 * `infrastructure/gtm/pubsub-tag-template.js`, and it is covered by
 * `pubsub-tag-template.tests.js` in the same directory — which runs inside
 * GTM's template editor, NOT in this suite (jest roots are `tests/` and
 * `src/`). So that behaviour is tested, but not automatically, and this comment
 * is the only place that says so.
 */
import * as fs from 'fs';
import * as path from 'path';

const specPath = path.resolve(__dirname, '../../infrastructure/gtm/server-container.json');
const spec = JSON.parse(fs.readFileSync(specPath, 'utf-8'));

interface Tag {
  name: string;
  type: string;
  firingTrigger?: string;
  templateParameters?: Record<string, string>;
  consentRequired?: string[];
}

const tags: Tag[] = spec.tags;
const byName = (name: string) => tags.find((t) => t.name === name);

/** The generic route: one trigger, every GA4-client event, three destinations. */
const GENERIC_TRIGGER = 'clientName - GA4';

describe('sGTM server container, the real-time pipeline', () => {
  it('routes every GA4-client event through one generic trigger, not per-event tags', () => {
    const destinations = ['Pub/Sub Publish', 'BigQuery API', '[Stape] GA4 - Base'];
    for (const name of destinations) {
      const tag = byName(name);
      expect(tag).toBeDefined();
      expect(tag!.firingTrigger).toBe(GENERIC_TRIGGER);
    }
  });

  it('publishes to the topic the event-stream service subscribes to', () => {
    // If this drifts, the real-time overlay goes quiet with no error anywhere:
    // the tag succeeds, the messages go somewhere nothing is listening.
    expect(byName('Pub/Sub Publish')!.templateParameters!.topicPath).toBe(
      'projects/iampatterson/topics/iampatterson-events',
    );
  });

  it('writes to the events table the warehouse reads', () => {
    const bq = byName('BigQuery API')!.templateParameters!;
    expect(bq.tableId).toBe('iampatterson.iampatterson_raw.events_raw');
    expect(bq.writeableData).toBe('fullEventData');
  });

  it('publishes regardless of consent, because the pipeline records the block', () => {
    // The Pub/Sub tag must fire even for a declining visitor: the payload
    // carries `blocked_consent` routing statuses, which is what lets the
    // overlay show a decliner that their choice was honoured. Gating this tag
    // would make the privacy demonstration disappear rather than work.
    expect(byName('Pub/Sub Publish')!.consentRequired).toEqual([]);
  });

  it('simulated ad-platform tags stay on the conversion-only trigger', () => {
    // Meta and Google Ads are simulations (no real ad accounts), fired only on
    // purchase/trial_signup/form_complete rather than every event.
    for (const name of ['Meta CAPI - Simulated', 'Google Ads Enhanced Conversions - Simulated']) {
      expect(byName(name)!.firingTrigger).toBe('ce - conversions');
    }
  });

  it('describes the container it was captured from, not an intended one', () => {
    // The guard against this file drifting back into fiction: every tag the
    // spec names must be one the capture produced.
    expect(tags.map((t) => t.name).sort()).toEqual([
      'BigQuery API',
      'Google Ads Enhanced Conversions - Simulated',
      'Meta CAPI - Simulated',
      'Pub/Sub Publish',
      '[Stape] GA4 - Base',
    ]);
  });
});
