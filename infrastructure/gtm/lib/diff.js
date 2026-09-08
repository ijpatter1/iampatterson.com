/**
 * The reconciler's diff.
 *
 * Both sides arrive in spec shape — live is mapped through `mapping.fromApi`
 * before it gets here — so this file compares like with like and never sees an
 * API `parameter[]`.
 *
 * Two decisions worth stating, because everything else follows from them:
 *
 *   Name is identity. These containers key on human-readable names ("GA4 -
 *   add_to_cart", "ce - add_to_cart"), which is what makes the specs readable.
 *   A duplicate name therefore makes "the same entity" undefined, and is an
 *   error rather than a last-one-wins.
 *
 *   The spec owns three collections and nothing else. Built-in variables,
 *   folders and custom templates are live in both containers and represented
 *   in neither spec (2026-09-08 census). They are outside the reconciler's
 *   ownership, so they are neither drift nor deletion candidates.
 */

/** The collections the specs describe. Everything else live is left alone. */
const OWNED = ['tags', 'triggers', 'variables'];

function indexByName(entities, side) {
  const out = new Map();
  for (const e of entities || []) {
    if (out.has(e.name)) {
      throw new Error(`diff: duplicate name "${e.name}" in ${side}; name is the identity key here`);
    }
    out.set(e.name, e);
  }
  return out;
}

/**
 * Field-level comparison over the keys the SPEC declares, name excluded.
 *
 * The spec is a partial specification: it asserts what it declares and is
 * silent about the rest, the same contract as Terraform's ignore_changes. Live
 * GA4 tags carry measurementIdOverride, sendEcommerceData and
 * eventSettingsVariable that no spec entry describes; comparing the union
 * would report all of them as permanent drift.
 */
/**
 * Order-insensitive serialisation. The live API returns parameters in its own
 * list order and the committed JSON has its authoring order, so comparing raw
 * serialised forms manufactured updates for semantically identical entities —
 * which then ran the merge paths, on a report an operator publishes from.
 */
function stable(value) {
  if (Array.isArray(value)) return JSON.stringify([...value].map(stable).sort());
  if (value && typeof value === 'object') {
    return JSON.stringify(
      Object.keys(value)
        .sort()
        .map((k) => [k, stable(value[k])]),
    );
  }
  return JSON.stringify(value);
}

function changedFields(before, after) {
  const keys = new Set(Object.keys(after));
  keys.delete('name');
  const fields = [];
  for (const k of keys) {
    if (stable(before[k]) !== stable(after[k])) fields.push(k);
  }
  return fields.sort();
}

/**
 * Compare one collection. Output is sorted by name throughout: the API returns
 * entities in no guaranteed order, and an operator reading two dry runs should
 * see a difference only when something differed.
 */
function diffCollection(spec, live) {
  const specByName = indexByName(spec, 'the spec');
  const liveByName = indexByName(live, 'the live container');

  const adds = [];
  const updates = [];
  const deletes = [];
  let unchanged = 0;

  for (const name of [...specByName.keys()].sort()) {
    const want = specByName.get(name);
    const have = liveByName.get(name);
    if (!have) {
      adds.push(want);
      continue;
    }
    const fields = changedFields(have, want);
    if (fields.length) updates.push({ name, fields, before: have, after: want });
    else unchanged += 1;
  }

  for (const name of [...liveByName.keys()].sort()) {
    if (!specByName.has(name)) deletes.push(liveByName.get(name));
  }

  return {
    adds,
    updates,
    deletes,
    unchanged,
    changed: adds.length + updates.length + deletes.length > 0,
  };
}

/** Compare a whole container, one owned collection at a time. */
function diffContainer(spec, live) {
  const collections = {};
  const totals = { adds: 0, updates: 0, deletes: 0 };

  for (const coll of OWNED) {
    const d = diffCollection(spec[coll] || [], live[coll] || []);
    collections[coll] = d;
    totals.adds += d.adds.length;
    totals.updates += d.updates.length;
    totals.deletes += d.deletes.length;
  }

  return {
    collections,
    totals,
    changed: totals.adds + totals.updates + totals.deletes > 0,
  };
}

module.exports = { diffCollection, diffContainer, OWNED };
