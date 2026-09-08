/**
 * The GTM spec ↔ Tag Manager API v2 mapping (Phase 14, deliverable 14.1).
 *
 * The committed container specs are human-readable — a tag names its trigger
 * (`firingTrigger: "ce - add_to_cart"`) and carries a flat `parameters` map.
 * The API wants numeric `firingTriggerId` and a `parameter[]` array whose GA4
 * event bindings live in a nested `eventSettingsTable` list-of-maps. The
 * reconciler's diff is only as trustworthy as the translation between them,
 * so this pins the translation rather than the shape of either side.
 *
 * The fixtures are real payloads read from the live web container on
 * 2026-09-08 (see docs/verification/2026-09-08-gtm-container-census.md), with
 * the account/container/fingerprint envelope stripped. Inventing them would
 * defeat the purpose: the mapping exists to match what the API actually sends.
 */
import {
  tagFromApi,
  tagToApi,
  triggerFromApi,
  triggerToApi,
  variableFromApi,
  variableToApi,
  specToCanonical,
  consentToApi,
  consentFromApi,
} from '../../../infrastructure/gtm/lib/mapping.js';

/** Name↔id resolution the reconciler builds from a live workspace read. */
const ctx = {
  triggerIdByName: { 'ce - add_to_cart': '99' },
  triggerNameById: { '99': 'ce - add_to_cart' },
};

const LIVE_TAG = {
  tagId: '107',
  name: 'GA4 - add_to_cart',
  type: 'gaawe',
  parameter: [
    { type: 'boolean', key: 'sendEcommerceData', value: 'false' },
    {
      type: 'list',
      key: 'eventSettingsTable',
      list: [
        {
          type: 'map',
          map: [
            { type: 'template', key: 'parameter', value: 'product_id' },
            { type: 'template', key: 'parameterValue', value: '{{dlv - product_id}}' },
          ],
        },
        {
          type: 'map',
          map: [
            { type: 'template', key: 'parameter', value: 'quantity' },
            { type: 'template', key: 'parameterValue', value: '{{dlv - quantity}}' },
          ],
        },
      ],
    },
    { type: 'template', key: 'eventName', value: 'add_to_cart' },
    { type: 'template', key: 'measurementIdOverride', value: '{{const - ga4_measurement_id}}' },
  ],
  firingTriggerId: ['99'],
  parentFolderId: '39',
  tagFiringOption: 'oncePerEvent',
  consentSettings: { consentStatus: 'notNeeded' },
};

const LIVE_TRIGGER = {
  triggerId: '99',
  name: 'ce - add_to_cart',
  type: 'customEvent',
  customEventFilter: [
    {
      type: 'equals',
      parameter: [
        { type: 'template', key: 'arg0', value: '{{_event}}' },
        { type: 'template', key: 'arg1', value: 'add_to_cart' },
      ],
    },
  ],
};

const LIVE_DLV = {
  variableId: '36',
  name: 'dlv - session_id',
  type: 'v',
  parameter: [
    { type: 'integer', key: 'dataLayerVersion', value: '2' },
    { type: 'boolean', key: 'setDefaultValue', value: 'false' },
    { type: 'template', key: 'name', value: 'session_id' },
  ],
  parentFolderId: '35',
};

const LIVE_CONST = {
  variableId: '40',
  name: 'const - server_container_url',
  type: 'c',
  parameter: [{ type: 'template', key: 'value', value: 'https://io.iampatterson.com' }],
  parentFolderId: '39',
};

describe('tags', () => {
  it('reads a live GA4 tag into the spec shape, resolving the trigger by name', () => {
    expect(tagFromApi(LIVE_TAG, ctx)).toEqual({
      name: 'GA4 - add_to_cart',
      type: 'gaawe',
      eventName: 'add_to_cart',
      firingTrigger: 'ce - add_to_cart',
      parameters: {
        product_id: '{{dlv - product_id}}',
        quantity: '{{dlv - quantity}}',
      },
      measurementId: '{{const - ga4_measurement_id}}',
      consentRequired: [],
    });
  });

  it('writes a spec tag back to the API shape, nesting bindings in eventSettingsTable', () => {
    const api = tagToApi(tagFromApi(LIVE_TAG, ctx), ctx);
    expect(api.firingTriggerId).toEqual(['99']);
    const table = api.parameter.find((p: { key: string }) => p.key === 'eventSettingsTable');
    expect(table.type).toBe('list');
    expect(table.list).toHaveLength(2);
    expect(table.list[0].map).toEqual([
      { type: 'template', key: 'parameter', value: 'product_id' },
      { type: 'template', key: 'parameterValue', value: '{{dlv - product_id}}' },
    ]);
  });

  it('carries consent through as the canonical required-list, which the parity pin reads', () => {
    const api = tagToApi(tagFromApi(LIVE_TAG, ctx), ctx);
    expect(api.consentSettings).toEqual({ consentStatus: 'notNeeded' });
  });

  it('refuses a tag whose firing trigger does not exist, rather than emitting an unfired tag', () => {
    // The failure this guard exists for: an empty firingTriggerId is accepted
    // by the API and produces a tag that never fires — a silent no-op that
    // looks like a successful apply.
    const orphan = { ...tagFromApi(LIVE_TAG, ctx), firingTrigger: 'ce - does_not_exist' };
    expect(() => tagToApi(orphan, ctx)).toThrow(/ce - does_not_exist/);
  });
});

describe('triggers', () => {
  it('reads a customEvent trigger into the spec shape', () => {
    expect(triggerFromApi(LIVE_TRIGGER)).toEqual({
      name: 'ce - add_to_cart',
      type: 'customEvent',
      eventName: 'add_to_cart',
    });
  });

  it('writes it back with the {{_event}} equals filter the API expects', () => {
    expect(triggerToApi(triggerFromApi(LIVE_TRIGGER))).toEqual({
      name: 'ce - add_to_cart',
      type: 'customEvent',
      customEventFilter: LIVE_TRIGGER.customEventFilter,
    });
  });
});

describe('variables', () => {
  it('reads a data layer variable, dropping the API-side defaults', () => {
    expect(variableFromApi(LIVE_DLV)).toEqual({
      name: 'dlv - session_id',
      type: 'dataLayer',
      dataLayerVariable: 'session_id',
    });
  });

  it('reads a constant', () => {
    expect(variableFromApi(LIVE_CONST)).toEqual({
      name: 'const - server_container_url',
      type: 'constant',
      value: 'https://io.iampatterson.com',
    });
  });

  it('writes a data layer variable back with dataLayerVersion 2', () => {
    const api = variableToApi(variableFromApi(LIVE_DLV));
    expect(api.type).toBe('v');
    expect(api.parameter).toEqual(
      expect.arrayContaining([
        { type: 'integer', key: 'dataLayerVersion', value: '2' },
        { type: 'template', key: 'name', value: 'session_id' },
      ]),
    );
  });
});

describe('round trip', () => {
  // The property the reconciler's diff rests on. If a read-then-write is not
  // the identity on the fields the spec owns, every dry run reports drift that
  // is an artifact of the mapping rather than a real difference.
  it.each([
    ['tag', LIVE_TAG, tagFromApi, tagToApi],
    ['trigger', LIVE_TRIGGER, triggerFromApi, triggerToApi],
    ['dlv', LIVE_DLV, variableFromApi, variableToApi],
    ['constant', LIVE_CONST, variableFromApi, variableToApi],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ])('%s survives spec → API → spec unchanged', (_label, live: any, from: any, to: any) => {
    const spec = from(live, ctx);
    expect(from({ ...live, ...to(spec, ctx) }, ctx)).toEqual(spec);
  });
});

/**
 * The committed specs are not a mechanical projection of the API. They use
 * human type labels ("GA4 Event (gaawe)"), carry prose `note` fields, and
 * describe consent as `{ analytics_storage: "required" }` where the API wants
 * a `consentStatus` enum and a LIST parameter. `specToCanonical` is the second
 * half of the mapping the deliverable names: it brings a committed entity into
 * the same shape `fromApi` produces, so the diff compares like with like.
 */
describe('specToCanonical', () => {
  it('reads the human type label the specs use', () => {
    expect(specToCanonical({ name: 'x', type: 'GA4 Event (gaawe)' }).type).toBe('gaawe');
    // The parenthetical says gtag; the API calls it googtag. An alias, not a
    // parse — stripping parentheses alone would produce a type the API rejects.
    expect(specToCanonical({ name: 'x', type: 'Google Tag (gtag)' }).type).toBe('googtag');
  });

  it('drops `note`, which documents intent and is not configuration', () => {
    const spec = { name: 'ce - a', type: 'customEvent', eventName: 'a', note: 'why this exists' };
    expect(specToCanonical(spec)).not.toHaveProperty('note');
    // And dropping it must not read as a change, or every noted entity is
    // permanently drifted.
    expect(specToCanonical(spec)).toEqual({ name: 'ce - a', type: 'customEvent', eventName: 'a' });
  });

  it('translates the spec consent vocabulary into the API enum', () => {
    expect(specToCanonical({ name: 'x', type: 'GA4 Event (gaawe)',
      consentSettings: { analytics_storage: 'required', note: 'ignored' } }).consentRequired)
      .toEqual(['analytics_storage']);
    expect(specToCanonical({ name: 'x', type: 'GA4 Event (gaawe)', consentSettings: {} }).consentRequired)
      .toEqual([]);
  });
});

describe('consent round trip', () => {
  // Shape confirmed empirically on 2026-09-08 against an isolated throwaway
  // workspace: the list item type is `template`, not the `STRING` the API
  // reference names. Guessing from the docs would have written a silently
  // wrong consent configuration onto 21 production tags.
  const API_NEEDED = {
    consentStatus: 'needed',
    consentType: { type: 'list', list: [{ type: 'template', value: 'analytics_storage' }] },
  };

  it('writes the shape the API actually accepted', () => {
    expect(consentToApi(['analytics_storage'])).toEqual(API_NEEDED);
    expect(consentToApi([])).toEqual({ consentStatus: 'notNeeded' });
  });

  it('reads it back to the same list', () => {
    expect(consentFromApi(API_NEEDED)).toEqual(['analytics_storage']);
    expect(consentFromApi({ consentStatus: 'notNeeded' })).toEqual([]);
    expect(consentFromApi(undefined)).toEqual([]);
  });
});

describe('built-in triggers', () => {
  // `GA4 - Config` fires on 2147479573, which is not in the workspace triggers
  // collection — built-in trigger ids live in their own range. The spec calls
  // it "All Pages". The reconciler treats such a reference as opaque and keeps
  // whatever live already uses, rather than inventing an id it cannot verify.
  it('preserves an unresolvable trigger when the live tag already has one', () => {
    const spec = { name: 'GA4 - Config', type: 'googtag', firingTrigger: 'All Pages', parameters: {} };
    const existing = { firingTriggerId: ['2147479573'] };
    expect(tagToApi(spec, ctx, existing).firingTriggerId).toEqual(['2147479573']);
  });

  it('still refuses an unresolvable trigger on a tag that does not exist yet', () => {
    const spec = { name: 'GA4 - New', type: 'gaawe', firingTrigger: 'All Pages', parameters: {} };
    expect(() => tagToApi(spec, ctx)).toThrow(/All Pages/);
  });
});

describe('tagToApi merges over live rather than replacing it', () => {
  // A PUT replaces the resource, and the specs describe a subset of a tag.
  // Building the body from the spec alone would strip measurementIdOverride
  // from 18 live tags — found by the first dry run, before any write.
  const EXISTING = {
    tagId: '107',
    name: 'GA4 - add_to_cart',
    type: 'gaawe',
    parameter: [
      { type: 'boolean', key: 'sendEcommerceData', value: 'false' },
      { type: 'template', key: 'eventName', value: 'add_to_cart' },
      { type: 'template', key: 'measurementIdOverride', value: '{{const - ga4_measurement_id}}' },
      { type: 'template', key: 'eventSettingsVariable', value: '{{ga4 - shared_event_settings}}' },
    ],
    firingTriggerId: ['99'],
    parentFolderId: '39',
    tagFiringOption: 'oncePerEvent',
  };
  const SPEC = {
    name: 'GA4 - add_to_cart',
    type: 'gaawe',
    eventName: 'add_to_cart',
    firingTrigger: 'ce - add_to_cart',
    parameters: { product_id: '{{dlv - product_id}}' },
    consentRequired: ['analytics_storage'],
  };

  const paramsOf = (api: { parameter: { key: string; value?: string }[] }) =>
    Object.fromEntries(api.parameter.map((p) => [p.key, p.value]));

  it('keeps parameters the spec does not describe', () => {
    const api = tagToApi(SPEC, ctx, EXISTING);
    const p = paramsOf(api);
    expect(p.measurementIdOverride).toBe('{{const - ga4_measurement_id}}');
    expect(p.eventSettingsVariable).toBe('{{ga4 - shared_event_settings}}');
    expect(p.sendEcommerceData).toBe('false');
  });

  it('keeps placement and firing options the spec has no vocabulary for', () => {
    const api = tagToApi(SPEC, ctx, EXISTING);
    expect(api.parentFolderId).toBe('39');
    expect(api.tagFiringOption).toBe('oncePerEvent');
  });

  it('still applies what the spec does declare', () => {
    const api = tagToApi(SPEC, ctx, EXISTING);
    const table = api.parameter.find((p: { key: string }) => p.key === 'eventSettingsTable');
    expect(table.list).toHaveLength(1);
    expect(api.consentSettings.consentStatus).toBe('needed');
  });
});

describe('googtag (the GA4 Config tag)', () => {
  // The single highest-risk tag in the container: it initialises GA4, so a
  // wrong body breaks every downstream tag. Its live configuration already
  // matches the spec's intent, and the mapping exists so the diff says that
  // honestly instead of reporting a difference in vocabulary.
  const LIVE_CONFIG = {
    tagId: '66',
    name: 'GA4 - Config',
    type: 'googtag',
    parameter: [
      { type: 'template', key: 'tagId', value: '{{const - ga4_measurement_id}}' },
      {
        type: 'list',
        key: 'configSettingsTable',
        list: [
          {
            type: 'map',
            map: [
              { type: 'template', key: 'parameter', value: 'server_container_url' },
              { type: 'template', key: 'parameterValue', value: '{{const - server_container_url}}' },
            ],
          },
          {
            type: 'map',
            map: [
              { type: 'template', key: 'parameter', value: 'send_page_view' },
              { type: 'template', key: 'parameterValue', value: 'false' },
            ],
          },
        ],
      },
    ],
    firingTriggerId: ['2147479573'],
    consentSettings: { consentStatus: 'notNeeded' },
  };

  const SPEC_CONFIG = {
    name: 'GA4 - Config',
    type: 'Google Tag (gtag)',
    measurementId: '{{const - ga4_measurement_id}}',
    serverContainerUrl: '{{const - server_container_url}}',
    configSettings: { send_page_view: false },
    firingTrigger: 'All Pages',
    consentSettings: { analytics_storage: 'required' },
  };

  it('reads tagId as the measurement id and unpacks configSettingsTable', () => {
    const spec = tagFromApi(LIVE_CONFIG, ctx);
    expect(spec.measurementId).toBe('{{const - ga4_measurement_id}}');
    expect(spec.serverContainerUrl).toBe('{{const - server_container_url}}');
    expect(spec.configSettings).toEqual({ send_page_view: 'false' });
  });

  it('normalises the spec boolean to the string the API stores', () => {
    // The spec writes send_page_view: false; the API stores "false". Left
    // uncompared, the Config tag reads as drifted on every single run.
    expect(specToCanonical(SPEC_CONFIG).configSettings).toEqual({ send_page_view: 'false' });
  });

  it('agrees with live on everything the spec declares except consent', () => {
    // The only intended change to this tag. If anything else shows up here,
    // the mapping is wrong rather than the container.
    const fromLive = tagFromApi(LIVE_CONFIG, ctx);
    const fromSpec = specToCanonical(SPEC_CONFIG, new Set(['ce - add_to_cart']));
    const differing = Object.keys(fromSpec).filter(
      (k) => k !== 'name' && JSON.stringify(fromSpec[k]) !== JSON.stringify(fromLive[k]),
    );
    expect(differing).toEqual(['consentRequired']);
  });

  it('writes back a tagId and configSettingsTable, keeping the built-in trigger', () => {
    const api = tagToApi(specToCanonical(SPEC_CONFIG, new Set(['ce - add_to_cart'])), ctx, LIVE_CONFIG);
    const params = Object.fromEntries(api.parameter.map((p: { key: string }) => [p.key, p]));
    expect(params.tagId.value).toBe('{{const - ga4_measurement_id}}');
    expect(params.configSettingsTable.list).toHaveLength(2);
    expect(api.firingTriggerId).toEqual(['2147479573']);
    expect(api.consentSettings.consentStatus).toBe('needed');
  });
});

describe('gtes (the shared event settings variable)', () => {
  // Live supplies ten common GA4 parameters once through this variable, which
  // 17 of 18 tags reference. The spec predated it and repeated them inline on
  // every tag. Adopting the live design means the reconciler has to speak the
  // variable type that carries it.
  const LIVE_GTES = {
    variableId: '77',
    name: 'ga4 - shared_event_settings',
    type: 'gtes',
    parameter: [
      {
        type: 'list',
        key: 'eventSettingsTable',
        list: [
          {
            type: 'map',
            map: [
              { type: 'template', key: 'parameter', value: 'session_id' },
              { type: 'template', key: 'parameterValue', value: '{{dlv - session_id}}' },
            ],
          },
          {
            type: 'map',
            map: [
              { type: 'template', key: 'parameter', value: 'page_path' },
              { type: 'template', key: 'parameterValue', value: '{{dlv - page_path}}' },
            ],
          },
        ],
      },
    ],
  };

  it('reads its settings table as a flat parameters map', () => {
    expect(variableFromApi(LIVE_GTES)).toEqual({
      name: 'ga4 - shared_event_settings',
      type: 'eventSettings',
      parameters: { session_id: '{{dlv - session_id}}', page_path: '{{dlv - page_path}}' },
    });
  });

  it('writes it back as an eventSettingsTable', () => {
    const api = variableToApi(variableFromApi(LIVE_GTES));
    expect(api.type).toBe('gtes');
    const table = api.parameter.find((p: { key: string }) => p.key === 'eventSettingsTable');
    expect(table.list).toHaveLength(2);
    expect(table.list[0].map[0]).toEqual({ type: 'template', key: 'parameter', value: 'session_id' });
  });

  it('survives the round trip, so it is never spurious drift', () => {
    const spec = variableFromApi(LIVE_GTES);
    expect(variableFromApi({ ...LIVE_GTES, ...variableToApi(spec) })).toEqual(spec);
  });
});

describe('a new GA4 event tag needs a measurement id', () => {
  // The API rejects a gaawe tag whose measurementIdOverride is empty. Existing
  // tags survive because the body is merged over live, which already carries
  // it; a tag being CREATED has nothing to merge from. Caught here so a dry
  // run reports it, rather than mid-apply after the triggers have landed —
  // which is how it was actually found on 2026-09-08.
  const NEW_TAG = {
    name: 'GA4 - claudish_translate',
    type: 'gaawe',
    eventName: 'claudish_translate',
    firingTrigger: 'ce - add_to_cart',
    parameters: {},
    consentRequired: [],
  };

  it('refuses to build one without it', () => {
    expect(() => tagToApi(NEW_TAG, ctx)).toThrow(/measurement id/i);
  });

  it('accepts one that declares it', () => {
    const api = tagToApi({ ...NEW_TAG, measurementId: '{{const - ga4_measurement_id}}' }, ctx);
    const p = Object.fromEntries(api.parameter.map((x: { key: string; value?: string }) => [x.key, x.value]));
    expect(p.measurementIdOverride).toBe('{{const - ga4_measurement_id}}');
  });

  it('accepts an existing tag that already has one live', () => {
    const existing = {
      parameter: [{ type: 'template', key: 'measurementIdOverride', value: '{{const - ga4_measurement_id}}' }],
    };
    expect(() => tagToApi(NEW_TAG, ctx, existing)).not.toThrow();
  });
});
