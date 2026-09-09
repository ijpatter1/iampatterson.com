/**
 * Claudish translator — GTM container + BigQuery schema pins
 * (feat/claudish M6).
 *
 * Guards the documented drift class (schema adds events, the container
 * never follows, the overlay claims routing that doesn't exist): the
 * four claudish_* events need web-container customEvent triggers + GA4
 * tags with their param maps and consent gating, the deploy script must
 * declare the same allow-lists, the server container's generic All-GA4
 * forwarding covers them (asserted, not assumed), and — the R3 privacy
 * mitigation — the GA4 Config tag must NOT carry a page_location
 * override (a config-level field freezes SPA attribution at the entry
 * URL); the ?t= strip is a parse-time inline script in the claudish
 * layout, pinned here against the source.
 */
import * as fs from 'fs';
import * as path from 'path';

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, p), 'utf-8');
const webContainer = JSON.parse(read('../../infrastructure/gtm/web-container.json'));
const serverContainer = JSON.parse(read('../../infrastructure/gtm/server-container.json'));
const bqSchema = JSON.parse(read('../../infrastructure/bigquery/schema.json')) as Array<{
  name: string;
  type: string;
}>;

interface Trigger {
  name: string;
  type: string;
  eventName?: string;
}
interface Tag {
  name: string;
  eventName?: string;
  firingTrigger?: string;
  parameters?: Record<string, string>;
  consentSettings?: Record<string, string>;
}

const triggers: Trigger[] = webContainer.triggers;
const tags: Tag[] = webContainer.tags;
const variables: Array<{ name: string; type: string; value?: string; code?: string }> =
  webContainer.variables;

const CLAUDISH_EVENTS: Record<string, string[]> = {
  claudish_translate: [
    'direction',
    'source_mode',
    'detected_language',
    'detector_source',
    'outcome',
    'input_chars',
    'input_em_dashes',
    'output_chars',
    'ttft_ms',
    'duration_ms',
    'cache',
  ],
  claudish_detected: ['detected_language', 'detector_source', 'input_chars'],
  claudish_share: [
    'share_action',
    'direction',
    'output_chars',
    'share_truncated',
    'share_url_chars',
  ],
  claudish_rate: ['rating', 'direction', 'output_chars'],
};

describe.each(Object.entries(CLAUDISH_EVENTS))('web container: %s', (eventName, params) => {
  it('has a customEvent trigger', () => {
    const trigger = triggers.find((t) => t.eventName === eventName);
    expect(trigger).toBeDefined();
    expect(trigger?.type).toBe('customEvent');
  });

  it('has a GA4 tag firing on that trigger with every event param mapped', () => {
    const tag = tags.find((t) => t.eventName === eventName);
    expect(tag).toBeDefined();
    expect(tag?.firingTrigger).toBe(`ce - ${eventName}`);
    for (const param of params) {
      expect(tag?.parameters?.[param]).toBe(`{{dlv - ${param}}}`);
    }
  });

  it('requires analytics_storage consent (mirrors every sibling tag)', () => {
    const tag = tags.find((t) => t.eventName === eventName);
    expect(tag?.consentSettings?.analytics_storage).toBe('required');
  });

  it('has a dlv variable for every param', () => {
    for (const param of params) {
      expect(variables.some((v) => v.name === `dlv - ${param}`)).toBe(true);
    }
  });
});

describe('R3 mitigation: the share payload never reaches GA4 (and never freezes attribution)', () => {
  it('the GA4 Config tag has NO page_location override — a config-level field freezes every SPA hit at the entry URL', () => {
    // Anti-regression pin for the adversarially-confirmed mechanism
    // (2026-08-31): the config tag fires once per full page load, so a
    // configSettings.page_location would replace per-hit auto-collection
    // with the frozen entry URL site-wide. The privacy strip lives in
    // src/app/claudish/layout.tsx as a parse-time inline script instead.
    const config = tags.find((t) => t.name === 'GA4 - Config') as
      | (Tag & { configSettings?: Record<string, unknown> })
      | undefined;
    expect(config?.configSettings?.page_location).toBeUndefined();
    expect(variables.some((v) => v.name === 'cjs - page_location clean')).toBe(false);
  });

  it('the layout ships the parse-time strip (before gtag can fire, before links are clickable)', () => {
    const layout = fs.readFileSync(
      path.resolve(__dirname, '../../src/app/claudish/layout.tsx'),
      'utf-8'
    );
    expect(layout).toContain("searchParams.delete('t')");
    expect(layout).toContain('history.replaceState(history.state');
    expect(layout).toContain('dangerouslySetInnerHTML');
  });
});

describe('server container coverage', () => {
  it('forwards claudish events through the generic route, with no per-event tags', () => {
    // Corrected 2026-09-08 ([14.1]). This named the trigger `All GA4 Events`
    // and its tags `GA4 - Forwarding` / `BigQuery - Write All Events` /
    // `Pub/Sub - Publish All Events`. The census found none of those exist:
    // the spec had been describing an intended container, and this test was
    // comparing that document to itself. The live route is `clientName - GA4`,
    // a type=always trigger filtered on `{{Client Name}} contains GA4`.
    const generic = serverContainer.triggers.find(
      (t: { name: string }) => t.name === 'clientName - GA4'
    );
    expect(generic).toBeDefined();
    const generics = serverContainer.tags.filter(
      (t: { firingTrigger?: string }) => t.firingTrigger === 'clientName - GA4'
    );
    expect(generics.map((t: { name: string }) => t.name).sort()).toEqual([
      'BigQuery API',
      'Pub/Sub Publish',
      '[Stape] GA4 - Base',
    ]);
  });
});

/**
 * Re-homed 2026-09-08 ([14.1]) off `deploy-claudish.js`'s source text.
 *
 * These asserted that the deploy script's hardcoded allow-lists mentioned every
 * claudish event and dlv. The script has been retired: the reconciler applies
 * the committed spec, and the census proved the script had never been run
 * against production anyway — the spec claimed four pipelines that did not
 * exist until 2026-09-08. Asserting the spec is asserting what production runs.
 */
describe('the claudish pipelines are declared in the container spec', () => {
  it('declares a trigger and a GA4 tag for every claudish event', () => {
    for (const eventName of Object.keys(CLAUDISH_EVENTS)) {
      const trigger = webContainer.triggers.find(
        (t: { name: string; eventName?: string }) => t.eventName === eventName,
      );
      expect(trigger).toBeDefined();
      const tag = webContainer.tags.find((t: { name: string }) => t.name === `GA4 - ${eventName}`);
      expect(tag).toBeDefined();
      expect(tag.firingTrigger).toBe(trigger.name);
    }
  });

  it('declares a data layer variable for every parameter those tags send', () => {
    const declared = new Set(webContainer.variables.map((v: { name: string }) => v.name));
    for (const params of Object.values(CLAUDISH_EVENTS)) {
      for (const param of params as string[]) {
        expect(declared).toContain(`dlv - ${param}`);
      }
    }
  });

  it('binds each tag parameter to its variable, not just to a name', () => {
    // The failure this catches: a dlv exists and the tag never references it,
    // so the column lands null and the overlay claims a field it did not send.
    for (const [eventName, params] of Object.entries(CLAUDISH_EVENTS)) {
      const tag = webContainer.tags.find((t: { name: string }) => t.name === `GA4 - ${eventName}`);
      for (const param of params as string[]) {
        expect(tag.parameters[param]).toBe(`{{dlv - ${param}}}`);
      }
    }
  });

  it('keeps the page_location warning on the config tag, where the container carries it', () => {
    // The warning outlived the script that used to hold it: setting
    // page_location in configSettings freezes every SPA hit at the landing URL,
    // a site-wide attribution regression caught by adversarial review.
    const config = webContainer.tags.find((t: { name: string }) => t.name === 'GA4 - Config');
    expect(config.note).toContain('NEVER set page_location');
    // And the spec must not actually do it.
    expect(Object.keys(config.configSettings ?? {})).not.toContain('page_location');
  });
});

describe('BigQuery schema columns (lock-step with the event schema)', () => {
  const names = bqSchema.map((c) => c.name);
  it.each([
    ['direction', 'STRING'],
    ['source_mode', 'STRING'],
    ['detected_language', 'STRING'],
    ['detector_source', 'STRING'],
    ['outcome', 'STRING'],
    ['input_chars', 'INT64'],
    ['input_em_dashes', 'INT64'],
    ['output_chars', 'INT64'],
    ['ttft_ms', 'INT64'],
    ['duration_ms', 'INT64'],
    ['cache', 'STRING'],
    ['share_action', 'STRING'],
    ['share_truncated', 'BOOL'],
    ['share_url_chars', 'INT64'],
    ['rating', 'STRING'],
  ])('includes %s as %s', (name, type) => {
    expect(names).toContain(name);
    expect(bqSchema.find((c) => c.name === name)?.type).toBe(type);
  });
});
