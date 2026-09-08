/**
 * Reconciler orchestration: read live, diff against the committed spec, and
 * optionally converge live onto it.
 *
 * The CLI is a thin shell over this. Everything that decides what to write is
 * here and takes an injected client, so the whole apply path — including the
 * ordering and the refusals — is exercised offline.
 *
 * Three rules the rest of the file implements:
 *
 *   Dry run is the default. Nothing writes unless `apply` is passed, and
 *   publishing is a third step beyond that, not a consequence of applying.
 *
 *   Dependencies are created before their dependents. A tag names its trigger
 *   and the API wants an id, so variables and triggers land first and the
 *   name→id index is refreshed from what was just created. Getting this wrong
 *   writes a tag that never fires.
 *
 *   A failure stops the run. Half-applying a container and carrying on would
 *   leave it in a state nobody described.
 */

const { diffContainer, OWNED } = require('./diff.js');
const {
  specToCanonical,
  tagFromApi,
  tagToApi,
  triggerFromApi,
  triggerToApi,
  variableFromApi,
  variableToApi,
} = require('./mapping.js');

/** Dependency order. Tags reference triggers and variables, so tags land last. */
const APPLY_ORDER = ['variables', 'triggers', 'tags'];

const FROM_API = { tags: tagFromApi, triggers: triggerFromApi, variables: variableFromApi };
const TO_API = { tags: tagToApi, triggers: triggerToApi, variables: variableToApi };

/** Reads the collections the spec owns. Everything else live is not our business. */
async function readLive(client, containerId, workspaceId) {
  const live = {};
  for (const collection of OWNED) {
    live[collection] = await client.list(containerId, workspaceId, collection);
  }
  return live;
}

function buildTriggerIndex(triggers) {
  const triggerIdByName = {};
  const triggerNameById = {};
  for (const t of triggers) {
    if (!t.triggerId) continue;
    triggerIdByName[t.name] = t.triggerId;
    triggerNameById[t.triggerId] = t.name;
  }
  return { triggerIdByName, triggerNameById };
}

async function reconcile({
  client,
  containerId,
  spec,
  apply = false,
  allowDeletes = false,
  publish = false,
  versionName,
}) {
  const workspaceId = await client.defaultWorkspaceId(containerId);
  const liveRaw = await readLive(client, containerId, workspaceId);
  const ctx = buildTriggerIndex(liveRaw.triggers);

  /** Live entities keyed by name, kept raw so an update can reuse ids and paths. */
  const rawByName = {};
  const liveCanonical = {};
  for (const collection of OWNED) {
    rawByName[collection] = new Map(liveRaw[collection].map((e) => [e.name, e]));
    liveCanonical[collection] = liveRaw[collection].map((e) => FROM_API[collection](e, ctx));
  }

  // Live triggers plus the ones this spec declares. Anything a tag names that
  // is in neither is a built-in trigger, which the reconciler preserves rather
  // than manages.
  const knownTriggerNames = new Set([
    ...liveRaw.triggers.map((t) => t.name),
    ...(spec.triggers || []).map((t) => t.name),
  ]);

  const specCanonical = {};
  for (const collection of OWNED) {
    specCanonical[collection] = (spec[collection] || []).map((e) =>
      specToCanonical(e, knownTriggerNames),
    );
  }

  const diff = diffContainer(specCanonical, liveCanonical);
  if (!apply || !diff.changed) {
    return { diff, applied: false, workspaceId, versionId: null };
  }

  for (const collection of APPLY_ORDER) {
    const d = diff.collections[collection];

    for (const entity of d.adds) {
      const body = TO_API[collection](entity, ctx);
      const created = await client.create(containerId, workspaceId, collection, body);
      // A trigger created in this pass is what a tag later in the pass must
      // resolve against, so the index grows as we go.
      if (collection === 'triggers' && created && created.triggerId) {
        ctx.triggerIdByName[created.name] = created.triggerId;
        ctx.triggerNameById[created.triggerId] = created.name;
      }
    }

    for (const { name, after } of d.updates) {
      const existing = rawByName[collection].get(name);
      const body = TO_API[collection](after, ctx, existing);
      await client.update(existing.path, body);
    }

    if (allowDeletes) {
      for (const entity of d.deletes) {
        await client.remove(rawByName[collection].get(entity.name).path);
      }
    }
  }

  let versionId = null;
  if (publish) {
    const created = await client.createVersion(
      containerId,
      workspaceId,
      versionName || `reconcile ${new Date().toISOString()}`,
    );
    versionId = created && created.containerVersion && created.containerVersion.containerVersionId;
    await client.publish(containerId, versionId);
  }

  return { diff, applied: true, workspaceId, versionId };
}

module.exports = { reconcile, APPLY_ORDER };
