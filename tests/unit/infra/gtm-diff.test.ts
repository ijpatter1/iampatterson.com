/**
 * The reconciler's diff (Phase 14, deliverable 14.1).
 *
 * Everything the operator reads before an apply comes out of here, so the
 * assertions are about the report being trustworthy and reviewable: a
 * difference is classified once, an identical entity is silent, a changed
 * entity names the fields that changed, and the output does not churn when the
 * API returns entities in a different order.
 *
 * Both sides arrive already in spec shape — live is mapped through
 * `mapping.fromApi` first — so this file never sees a `parameter[]`.
 */
import { diffCollection, diffContainer } from '../../../infrastructure/gtm/lib/diff.js';

const tag = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  type: 'gaawe',
  eventName: name.replace('GA4 - ', ''),
  firingTrigger: `ce - ${name.replace('GA4 - ', '')}`,
  parameters: {},
  ...extra,
});

describe('diffCollection', () => {
  it('classifies each name once: add, delete, update or unchanged', () => {
    const spec = [tag('GA4 - a'), tag('GA4 - b'), tag('GA4 - c', { eventName: 'changed' })];
    const live = [tag('GA4 - b'), tag('GA4 - c'), tag('GA4 - d')];
    const d = diffCollection(spec, live);

    expect(d.adds.map((x: { name: string }) => x.name)).toEqual(['GA4 - a']);
    expect(d.deletes.map((x: { name: string }) => x.name)).toEqual(['GA4 - d']);
    expect(d.updates.map((x: { name: string }) => x.name)).toEqual(['GA4 - c']);
    expect(d.unchanged).toBe(1);
  });

  it('says nothing about an entity that matches, which is what "no drift" means', () => {
    const d = diffCollection([tag('GA4 - a')], [tag('GA4 - a')]);
    expect(d.adds).toHaveLength(0);
    expect(d.updates).toHaveLength(0);
    expect(d.deletes).toHaveLength(0);
    expect(d.changed).toBe(false);
  });

  it('names the fields that changed, so a dry run can be reviewed rather than trusted', () => {
    const before = tag('GA4 - a', { parameters: { product_id: '{{dlv - product_id}}' } });
    const after = tag('GA4 - a', {
      parameters: { product_id: '{{dlv - product_id}}', quantity: '{{dlv - quantity}}' },
      consentStatus: 'notNeeded',
    });
    const [u] = diffCollection([after], [before]).updates;
    expect(u.fields.sort()).toEqual(['consentStatus', 'parameters']);
    expect(u.before.parameters).toEqual({ product_id: '{{dlv - product_id}}' });
    expect(u.after.parameters.quantity).toBe('{{dlv - quantity}}');
  });

  it('is stable under input order, so a dry run does not churn between runs', () => {
    const spec = [tag('GA4 - c'), tag('GA4 - a'), tag('GA4 - b')];
    const live = [tag('GA4 - b')];
    const forward = diffCollection(spec, live);
    const reversed = diffCollection([...spec].reverse(), live);
    expect(forward.adds.map((x: { name: string }) => x.name)).toEqual(['GA4 - a', 'GA4 - c']);
    expect(reversed).toEqual(forward);
  });

  it('treats a duplicate name in the spec as an error rather than picking one', () => {
    // Name is the identity key on both sides. Two entities sharing one makes
    // "the same entity" undefined, and silently keeping the last would apply
    // whichever the file happened to end with.
    expect(() => diffCollection([tag('GA4 - a'), tag('GA4 - a')], [])).toThrow(/GA4 - a/);
  });
});

describe('diffContainer', () => {
  const spec = {
    tags: [tag('GA4 - a')],
    triggers: [{ name: 'ce - a', type: 'customEvent', eventName: 'a' }],
    variables: [{ name: 'dlv - x', type: 'dataLayer', dataLayerVariable: 'x' }],
  };

  it('reports per collection and rolls up whether anything differs', () => {
    const d = diffContainer(spec, { tags: [], triggers: [], variables: [] });
    expect(d.changed).toBe(true);
    expect(d.collections.tags.adds).toHaveLength(1);
    expect(d.collections.triggers.adds).toHaveLength(1);
    expect(d.collections.variables.adds).toHaveLength(1);
    expect(d.totals).toEqual({ adds: 3, updates: 0, deletes: 0 });
  });

  it('is clean when the spec already describes live', () => {
    const d = diffContainer(spec, spec);
    expect(d.changed).toBe(false);
    expect(d.totals).toEqual({ adds: 0, updates: 0, deletes: 0 });
  });

  it('ignores live entity classes the spec does not own', () => {
    // built-in variables, folders and custom templates are live in both
    // containers and represented in neither spec (2026-09-08 census). They are
    // not the reconciler's to manage, so they are neither drift nor deletion
    // candidates — the census's central finding, pinned.
    const live = {
      ...spec,
      builtInVariable: [{ name: 'Page URL' }],
      folders: [{ name: 'GA4 Tags & Config' }],
      templates: [{ name: 'Write to BigQuery' }],
    };
    const d = diffContainer(spec, live);
    expect(d.changed).toBe(false);
    expect(Object.keys(d.collections).sort()).toEqual(['tags', 'triggers', 'variables']);
  });
});

describe('the spec is a partial specification', () => {
  // It asserts what it declares and is silent about the rest, the same
  // contract as Terraform's ignore_changes. Without this, every live field the
  // spec does not mention reads as permanent drift — and worse, an apply built
  // from the spec alone would delete it, because a PUT replaces the resource.
  // Live GA4 tags carry measurementIdOverride, sendEcommerceData and
  // eventSettingsVariable that no spec entry describes.
  it('does not report a live field the spec never declares', () => {
    const live = [{ name: 'GA4 - a', type: 'gaawe', parameters: {}, measurementId: '{{const - id}}' }];
    const spec = [{ name: 'GA4 - a', type: 'gaawe', parameters: {} }];
    expect(diffCollection(spec, live).changed).toBe(false);
  });

  it('still reports a field the spec declares differently', () => {
    const live = [{ name: 'GA4 - a', type: 'gaawe', parameters: {}, measurementId: '{{const - old}}' }];
    const spec = [{ name: 'GA4 - a', type: 'gaawe', parameters: {}, measurementId: '{{const - new}}' }];
    expect(diffCollection(spec, live).updates[0].fields).toEqual(['measurementId']);
  });

  it('reports a field the spec declares that live lacks entirely', () => {
    const live = [{ name: 'GA4 - a', type: 'gaawe', parameters: {} }];
    const spec = [{ name: 'GA4 - a', type: 'gaawe', parameters: {}, consentRequired: ['analytics_storage'] }];
    expect(diffCollection(spec, live).updates[0].fields).toEqual(['consentRequired']);
  });
});

describe('review finding 6 — comparison must not depend on ordering', () => {
  // The live API returns parameters in its own list order; the committed JSON
  // has its authoring order. Comparing serialised forms manufactured updates
  // for semantically identical tags — which then ran the merge paths that
  // findings 4 and 5 were about. A dry run an operator publishes on must not
  // invent changes.
  it('treats a parameters map with the same pairs in another order as unchanged', () => {
    const live = [tag('GA4 - a', { parameters: { b: '{{dlv - b}}', a: '{{dlv - a}}' } })];
    const spec = [tag('GA4 - a', { parameters: { a: '{{dlv - a}}', b: '{{dlv - b}}' } })];
    expect(diffCollection(spec, live).changed).toBe(false);
  });

  it('treats a consent list in another order as unchanged', () => {
    const live = [tag('GA4 - a', { consentRequired: ['analytics_storage', 'ad_storage'] })];
    const spec = [tag('GA4 - a', { consentRequired: ['ad_storage', 'analytics_storage'] })];
    expect(diffCollection(spec, live).changed).toBe(false);
  });

  it('still sees a genuine difference in the same shapes', () => {
    const live = [tag('GA4 - a', { parameters: { a: '{{dlv - a}}' } })];
    const spec = [tag('GA4 - a', { parameters: { a: '{{dlv - other}}' } })];
    expect(diffCollection(spec, live).updates[0].fields).toEqual(['parameters']);
  });
});
