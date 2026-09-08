/**
 * The reconciler's orchestration (Phase 14, deliverable 14.1).
 *
 * The CLI in reconcile.js is a thin shell over this; everything that decides
 * what to write lives here and runs against a fake client, so the whole apply
 * path is exercised without a network or a container.
 *
 * The ordering test is the one that matters most. A tag names its trigger, and
 * the API wants a numeric id, so a tag created before its trigger has no id to
 * resolve — the reconciler would either write an unfired tag or abort halfway
 * through, leaving the container half-applied.
 */
import { reconcile } from '../../../infrastructure/gtm/lib/reconcile-core.js';

interface Written {
  op: string;
  collection?: string;
  name?: string;
  path?: string;
}

/** A client that records writes and hands back ids for anything created. */
function fakeClient(live: Record<string, unknown[]>, written: Written[], failOn?: string) {
  let nextId = 500;
  return {
    written,
    defaultWorkspaceId: async () => '9',
    list: async (_c: string, _w: string, collection: string) => live[collection] || [],
    create: async (_c: string, _w: string, collection: string, entity: { name: string }) => {
      if (entity.name === failOn) throw new Error(`API 400: rejected ${entity.name}`);
      written.push({ op: 'create', collection, name: entity.name });
      nextId += 1;
      const idKey = { tags: 'tagId', triggers: 'triggerId', variables: 'variableId' }[collection]!;
      return { ...entity, [idKey]: String(nextId) };
    },
    update: async (path: string, entity: { name: string }) => {
      written.push({ op: 'update', path, name: entity.name });
      return entity;
    },
    remove: async (path: string) => {
      written.push({ op: 'delete', path });
      return {};
    },
    createVersion: async () => ({ containerVersion: { containerVersionId: '77' } }),
    publish: async () => {
      written.push({ op: 'publish' });
      return {};
    },
  };
}

const spec = {
  _meta: { containerId: 'GTM-MWHFMTZN' },
  variables: [{ name: 'dlv - direction', type: 'dataLayer', dataLayerVariable: 'direction' }],
  triggers: [
    { name: 'ce - claudish_translate', type: 'customEvent', eventName: 'claudish_translate' },
  ],
  tags: [
    {
      name: 'GA4 - claudish_translate',
      type: 'GA4 Event (gaawe)',
      eventName: 'claudish_translate',
      firingTrigger: 'ce - claudish_translate',
      parameters: { direction: '{{dlv - direction}}' },
      consentSettings: { analytics_storage: 'required' },
    },
  ],
};

const empty = { tags: [], triggers: [], variables: [], built_in_variables: [], folders: [] };

describe('dry run', () => {
  it('writes nothing at all', async () => {
    const written: Written[] = [];
    const result = await reconcile({
      client: fakeClient(empty, written),
      containerId: '247511905',
      spec,
    });
    expect(written).toHaveLength(0);
    expect(result.diff.totals.adds).toBe(3);
    expect(result.applied).toBe(false);
  });
});

describe('apply', () => {
  it('creates variables and triggers before the tags that reference them', async () => {
    // Without this order a tag has no trigger id to resolve. Asserting the
    // sequence rather than the set is the point.
    const written: Written[] = [];
    await reconcile({
      client: fakeClient(empty, written),
      containerId: '247511905',
      spec,
      apply: true,
    });
    expect(written.map((w) => w.collection)).toEqual(['variables', 'triggers', 'tags']);
  });

  it('resolves a tag onto the trigger it just created', async () => {
    const written: Written[] = [];
    const client = fakeClient(empty, written);
    const created: Record<string, unknown>[] = [];
    const wrapped = {
      ...client,
      create: async (c: string, w: string, coll: string, e: Record<string, unknown>) => {
        const out = await client.create(c, w, coll, e as { name: string });
        created.push({ collection: coll, entity: out });
        return out;
      },
    };
    await reconcile({ client: wrapped, containerId: '247511905', spec, apply: true });
    const trigger = created.find((x) => x.collection === 'triggers')!.entity as {
      triggerId: string;
    };
    const tag = created.find((x) => x.collection === 'tags')!.entity as {
      firingTriggerId: string[];
    };
    expect(tag.firingTriggerId).toEqual([trigger.triggerId]);
  });

  it('carries the spec consent requirement onto the tag it writes', async () => {
    const written: Written[] = [];
    const client = fakeClient(empty, written);
    let tagBody: { consentSettings?: unknown } = {};
    const wrapped = {
      ...client,
      create: async (c: string, w: string, coll: string, e: Record<string, unknown>) => {
        if (coll === 'tags') tagBody = e;
        return client.create(c, w, coll, e as { name: string });
      },
    };
    await reconcile({ client: wrapped, containerId: '247511905', spec, apply: true });
    expect(tagBody.consentSettings).toEqual({
      consentStatus: 'needed',
      consentType: { type: 'list', list: [{ type: 'template', value: 'analytics_storage' }] },
    });
  });

  it('leaves live entities the spec omits alone unless deletes are allowed', async () => {
    const live = {
      ...empty,
      tags: [
        {
          name: 'GA4 - orphan',
          type: 'gaawe',
          parameter: [],
          firingTriggerId: ['1'],
          path: 'p/orphan',
        },
      ],
    };
    const written: Written[] = [];
    const result = await reconcile({
      client: fakeClient(live, written),
      containerId: '247511905',
      spec,
      apply: true,
    });
    expect(result.diff.collections.tags.deletes).toHaveLength(1);
    expect(written.filter((w) => w.op === 'delete')).toHaveLength(0);
  });

  it('deletes only behind allowDeletes', async () => {
    const live = {
      ...empty,
      tags: [
        {
          name: 'GA4 - orphan',
          type: 'gaawe',
          parameter: [],
          firingTriggerId: ['1'],
          path: 'p/orphan',
        },
      ],
    };
    const written: Written[] = [];
    await reconcile({
      client: fakeClient(live, written),
      containerId: '247511905',
      spec,
      apply: true,
      allowDeletes: true,
    });
    expect(written.filter((w) => w.op === 'delete').map((w) => w.path)).toEqual(['p/orphan']);
  });

  it('stops on the first API failure rather than continuing half-applied', async () => {
    const written: Written[] = [];
    await expect(
      reconcile({
        client: fakeClient(empty, written, 'ce - claudish_translate'),
        containerId: '247511905',
        spec,
        apply: true,
      }),
    ).rejects.toThrow(/rejected ce - claudish_translate/);
    // The variable landed; nothing after the failure was attempted.
    expect(written.map((w) => w.collection)).toEqual(['variables']);
  });
});

describe('publish', () => {
  it('does not publish on a dry run, however the flag is set', async () => {
    const written: Written[] = [];
    await reconcile({
      client: fakeClient(empty, written),
      containerId: '247511905',
      spec,
      publish: true,
    });
    expect(written.filter((w) => w.op === 'publish')).toHaveLength(0);
  });

  it('publishes after a successful apply when asked, and reports the version', async () => {
    const written: Written[] = [];
    const result = await reconcile({
      client: fakeClient(empty, written),
      containerId: '247511905',
      spec,
      apply: true,
      publish: true,
    });
    expect(written.at(-1)!.op).toBe('publish');
    expect(result.versionId).toBe('77');
  });

  it('does not publish when there was nothing to apply', async () => {
    // A publish with no change still burns the workspace and creates a version,
    // which makes the container history lie about when things changed.
    const written: Written[] = [];
    const live = {
      ...empty,
      variables: [
        {
          name: 'dlv - direction',
          type: 'v',
          parameter: [
            { type: 'integer', key: 'dataLayerVersion', value: '2' },
            { type: 'template', key: 'name', value: 'direction' },
          ],
        },
      ],
      triggers: [
        {
          name: 'ce - claudish_translate',
          triggerId: '99',
          type: 'customEvent',
          customEventFilter: [
            {
              type: 'equals',
              parameter: [
                { type: 'template', key: 'arg0', value: '{{_event}}' },
                { type: 'template', key: 'arg1', value: 'claudish_translate' },
              ],
            },
          ],
        },
      ],
      tags: [
        {
          name: 'GA4 - claudish_translate',
          type: 'gaawe',
          firingTriggerId: ['99'],
          parameter: [
            {
              type: 'list',
              key: 'eventSettingsTable',
              list: [
                {
                  type: 'map',
                  map: [
                    { type: 'template', key: 'parameter', value: 'direction' },
                    { type: 'template', key: 'parameterValue', value: '{{dlv - direction}}' },
                  ],
                },
              ],
            },
            { type: 'template', key: 'eventName', value: 'claudish_translate' },
          ],
          consentSettings: {
            consentStatus: 'needed',
            consentType: { type: 'list', list: [{ type: 'template', value: 'analytics_storage' }] },
          },
        },
      ],
    };
    const result = await reconcile({
      client: fakeClient(live, written),
      containerId: '247511905',
      spec,
      apply: true,
      publish: true,
    });
    expect(result.diff.changed).toBe(false);
    expect(written).toHaveLength(0);
  });
});
