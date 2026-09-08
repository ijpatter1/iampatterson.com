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
      consentStatus: 'notNeeded',
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

  it('preserves consentSettings, which the consent parity pin reads', () => {
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
