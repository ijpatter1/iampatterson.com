/**
 * GTM spec ↔ Tag Manager API v2 mapping.
 *
 * The committed container specs are written for people: a tag names its
 * trigger and carries a flat `parameters` map. The API speaks in numeric
 * `firingTriggerId` and a `parameter[]` array whose GA4 event bindings sit in
 * a nested `eventSettingsTable` list-of-maps. Everything that translates
 * between those two vocabularies lives here, so the reconciler's diff has one
 * definition of "the same entity" instead of one per call site.
 *
 * The direction matters for what each function may assume:
 *   fromApi  — lossy on purpose. Drops ids, fingerprints, folder placement and
 *              API-side defaults, keeping only what the spec owns. Two entities
 *              that differ solely in dropped fields are not drift.
 *   toApi    — must be complete enough for a create/update to succeed, and is
 *              the only place a name is resolved to an id.
 *
 * Shapes were read from the live web container on 2026-09-08 rather than
 * recalled; see docs/verification/2026-09-08-gtm-container-census.md.
 */

/** Reads `parameter[]` as a plain object keyed by `key`. */
function byKey(parameters) {
  const out = {};
  for (const p of parameters || []) out[p.key] = p;
  return out;
}

const template = (key, value) => ({ type: 'template', key, value });

/**
 * Stand-in for a trigger that is not in the workspace triggers collection.
 *
 * GA4 - Config fires on 2147479573, a built-in trigger whose id cannot be
 * looked up and whose name this codebase cannot verify — the spec calls it
 * "All Pages", and that may or may not be what Google calls 2147479573.
 * Rather than assert a name it cannot check, the reconciler treats built-in
 * trigger assignment as unowned, the same as folders and custom templates:
 * both sides canonicalise to this sentinel, so it is preserved on write and
 * never reported as drift.
 */
const BUILT_IN_TRIGGER = '(built-in trigger)';

// ─── Tags ────────────────────────────────────────────────────────────────────

/**
 * `eventSettingsTable` is a list of two-entry maps — `parameter` naming the GA4
 * event parameter, `parameterValue` holding the (usually `{{variable}}`) value.
 * The spec flattens that to `{ [parameter]: parameterValue }`.
 */
function bindingsFromApi(table) {
  const out = {};
  for (const row of (table && table.list) || []) {
    const cells = byKey(row.map);
    if (cells.parameter)
      out[cells.parameter.value] = cells.parameterValue && cells.parameterValue.value;
  }
  return out;
}

function bindingsToApi(parameters) {
  return {
    type: 'list',
    key: 'eventSettingsTable',
    // Values are coerced because the API stores everything as a string and
    // reads it back as one: a spec writing `false` would otherwise be
    // permanent drift and a write on every apply.
    list: Object.entries(parameters || {}).map(([name, value]) => ({
      type: 'map',
      map: [template('parameter', name), template('parameterValue', String(value))],
    })),
  };
}

function tagFromApi(api, ctx) {
  const p = byKey(api.parameter);
  const spec = {
    name: api.name,
    type: api.type,
    firingTrigger: (api.firingTriggerId || []).map(
      (id) => (ctx.triggerNameById || {})[id] || BUILT_IN_TRIGGER,
    )[0],
    parameters: bindingsFromApi(p.eventSettingsTable),
  };
  if (p.eventName) spec.eventName = p.eventName.value;
  if (p.measurementIdOverride) spec.measurementId = p.measurementIdOverride.value;
  // The shared settings variable is what supplies the ten common parameters.
  // A created tag has nothing to merge it from, so the spec must declare it
  // and the diff must be able to see it.
  if (p.eventSettingsVariable) spec.sharedEventSettings = p.eventSettingsVariable.value;
  if (api.type === 'googtag') {
    // The Google Tag speaks its own dialect: the measurement id rides in
    // `tagId`, and the server container URL is one row of configSettingsTable
    // rather than a field. The spec names both directly.
    if (p.tagId) spec.measurementId = p.tagId.value;
    const config = bindingsFromApi(p.configSettingsTable);
    if (config.server_container_url !== undefined) {
      spec.serverContainerUrl = config.server_container_url;
      delete config.server_container_url;
    }
    spec.configSettings = config;
  }
  spec.consentRequired = consentFromApi(api.consentSettings);
  return spec;
}

function tagToApi(spec, ctx, existing) {
  let id = (ctx.triggerIdByName || {})[spec.firingTrigger];
  const resolvedFromSpec = Boolean(id);
  if (!id && existing && (existing.firingTriggerId || []).length) {
    // Built-in triggers ("All Pages" and friends) are not in the workspace
    // triggers collection and their ids cannot be looked up. Where live
    // already fires the tag on one, keep it rather than invent an id.
    [id] = existing.firingTriggerId;
  }
  if (!id) {
    // An empty firingTriggerId is accepted by the API and produces a tag that
    // never fires. That reads as a successful apply and is invisible until
    // someone notices the events missing, so it is a hard stop.
    throw new Error(
      `tagToApi: tag "${spec.name}" fires on trigger "${spec.firingTrigger}", which does not exist in this container`,
    );
  }
  // A PUT replaces the resource and the spec describes a subset of a tag, so
  // the body is built by overlaying what the spec owns onto what is live.
  // Building it from the spec alone strips measurementIdOverride,
  // sendEcommerceData and eventSettingsVariable — found by the first dry run
  // against the live container, before any write.
  const owned = new Map();
  if (spec.type === 'googtag') {
    if (spec.measurementId) owned.set('tagId', template('tagId', spec.measurementId));
    if (spec.configSettings || spec.serverContainerUrl !== undefined) {
      // Merge over whatever live already configures. Rebuilding the table from
      // a spec that declares only the URL would drop send_page_view and every
      // other row, on the one tag whose misconfiguration breaks all the others.
      const liveConfig = bindingsFromApi(
        byKey((existing && existing.parameter) || {}).configSettingsTable,
      );
      const config = { ...liveConfig, ...(spec.configSettings || {}) };
      if (spec.serverContainerUrl !== undefined) config.server_container_url = spec.serverContainerUrl;
      const table = bindingsToApi(config);
      owned.set('configSettingsTable', { ...table, key: 'configSettingsTable' });
    }
  }
  if (spec.parameters) owned.set('eventSettingsTable', bindingsToApi(spec.parameters));
  if (spec.eventName) owned.set('eventName', template('eventName', spec.eventName));
  if (spec.measurementId && spec.type !== 'googtag') {
    owned.set('measurementIdOverride', template('measurementIdOverride', spec.measurementId));
  }
  if (spec.sharedEventSettings) {
    owned.set('eventSettingsVariable', template('eventSettingsVariable', spec.sharedEventSettings));
  }

  const parameter = [];
  for (const p of (existing && existing.parameter) || []) {
    parameter.push(owned.has(p.key) ? owned.get(p.key) : p);
    owned.delete(p.key);
  }
  parameter.push(...owned.values());

  // The API rejects a GA4 event tag whose measurementIdOverride is empty.
  // Existing tags survive on the merge because live already carries it; a tag
  // being created has nothing to merge from. Refusing here means a dry run
  // reports it, instead of an apply failing after other entities have landed.
  if (spec.type === 'gaawe' && !parameter.some((p) => p.key === 'measurementIdOverride')) {
    throw new Error(
      `tagToApi: tag "${spec.name}" is a GA4 event tag with no measurement id; declare measurementId in the spec`,
    );
  }
  // The shared event settings variable supplies iap_source, which the sGTM
  // Pub/Sub tag gates on: without it an event is discarded server-side and the
  // BigQuery row lands with a null session. The API accepts its absence
  // silently and the diff cannot see an undeclared field, so the refusal has
  // to happen here — on creations only. A live tag that lacks the field is the
  // partial-specification contract at work, not this guard's business.
  if (!existing && spec.type === 'gaawe' && !parameter.some((p) => p.key === 'eventSettingsVariable')) {
    throw new Error(
      `tagToApi: tag "${spec.name}" is a GA4 event tag with no shared event settings variable; declare sharedEventSettings in the spec`,
    );
  }

  // Every firing trigger survives. Reading only the first and writing a
  // single-element array silently stopped a multi-trigger tag firing on its
  // others, with nothing in the dry run to say so.
  // The spec vocabulary names one firing trigger. Where live fires on several,
  // the spec is partial about them the same way it is partial about fields:
  // the live set is preserved, and a spec naming a trigger outside that set is
  // a hard stop rather than a silent truncation to one.
  let firingTriggerId = [id];
  const liveTriggers = (existing && existing.firingTriggerId) || [];
  if (liveTriggers.length > 1) {
    if (resolvedFromSpec && !liveTriggers.includes(id)) {
      throw new Error(
        `tagToApi: tag "${spec.name}" fires on ${liveTriggers.length} triggers live, and the spec names "${spec.firingTrigger}", which is not among them; the spec cannot express this change`,
      );
    }
    firingTriggerId = liveTriggers;
  }

  const api = {
    ...(existing || {}),
    name: spec.name,
    type: spec.type,
    parameter,
    firingTriggerId,
  };
  // Consent is merged like any other unowned field. Written unconditionally it
  // downgraded a tag to notNeeded whenever the spec was silent, and the diff
  // never compared the field, so no dry run could show it.
  if (spec.consentRequired !== undefined) {
    api.consentSettings = consentToApi(spec.consentRequired);
  } else if (existing && existing.consentSettings) {
    api.consentSettings = existing.consentSettings;
  }
  return api;
}

// ─── Triggers ────────────────────────────────────────────────────────────────

/**
 * A `customEvent` trigger matches the data layer `event` key, which the API
 * spells `{{_event}}` in an `equals` filter. The spec carries just the event
 * name.
 */
function triggerFromApi(api) {
  const spec = { name: api.name, type: api.type };
  const filter = (api.customEventFilter || [])[0];
  if (filter) {
    const args = byKey(filter.parameter);
    if (args.arg1) spec.eventName = args.arg1.value;
  }
  return spec;
}

function triggerToApi(spec) {
  const api = { name: spec.name, type: spec.type };
  if (spec.type === 'customEvent') {
    api.customEventFilter = [
      {
        type: 'equals',
        parameter: [template('arg0', '{{_event}}'), template('arg1', spec.eventName)],
      },
    ];
  }
  return api;
}

// ─── Variables ───────────────────────────────────────────────────────────────

/** The two variable types these containers use. `v` is a data layer read, `c` a constant. */
const VARIABLE_TYPE_TO_SPEC = { v: 'dataLayer', c: 'constant', gtes: 'eventSettings' };
const VARIABLE_TYPE_TO_API = { dataLayer: 'v', constant: 'c', eventSettings: 'gtes' };

function variableFromApi(api) {
  const p = byKey(api.parameter);
  const spec = { name: api.name, type: VARIABLE_TYPE_TO_SPEC[api.type] || api.type };
  if (api.type === 'v' && p.name) spec.dataLayerVariable = p.name.value;
  if (api.type === 'c' && p.value) spec.value = p.value.value;
  // A Google Tag Event Settings variable carries the parameters every tag
  // shares, so each tag's own table holds only what is event-specific.
  if (api.type === 'gtes') spec.parameters = bindingsFromApi(p.eventSettingsTable);
  return spec;
}

function variableToApi(spec) {
  const api = { name: spec.name, type: VARIABLE_TYPE_TO_API[spec.type] || spec.type };
  if (spec.type === 'dataLayer') {
    api.parameter = [
      { type: 'integer', key: 'dataLayerVersion', value: '2' },
      { type: 'boolean', key: 'setDefaultValue', value: 'false' },
      template('name', spec.dataLayerVariable),
    ];
  } else if (spec.type === 'constant') {
    api.parameter = [template('value', spec.value)];
  } else if (spec.type === 'eventSettings') {
    api.parameter = [bindingsToApi(spec.parameters)];
  }
  return api;
}

/**
 * Consent, in both directions.
 *
 * The API reference describes the consentType list items as type STRING; the
 * API actually accepts and returns `template`. Confirmed empirically on
 * 2026-09-08 by writing one tag in a throwaway workspace and reading it back,
 * because writing the documented shape onto 21 production tags and finding out
 * later is not a recoverable mistake.
 */
function consentToApi(required) {
  if (!required || !required.length) return { consentStatus: 'notNeeded' };
  return {
    consentStatus: 'needed',
    consentType: { type: 'list', list: required.map((v) => ({ type: 'template', value: v })) },
  };
}

function consentFromApi(consentSettings) {
  if (!consentSettings || consentSettings.consentStatus !== 'needed') return [];
  const list = (consentSettings.consentType && consentSettings.consentType.list) || [];
  return list.map((item) => item.value);
}

/**
 * Type labels as the committed specs write them. The parenthetical is not a
 * reliable parse: the specs say `gtag` where the API says `googtag`, so this
 * is an alias table with a parenthetical fallback rather than a regex.
 */
const SPEC_TYPE_ALIASES = {
  'GA4 Event (gaawe)': 'gaawe',
  'Google Tag (gtag)': 'googtag',
};

function normalizeType(type) {
  if (SPEC_TYPE_ALIASES[type]) return SPEC_TYPE_ALIASES[type];
  const parenthetical = /\(([^)]+)\)\s*$/.exec(type || '');
  return parenthetical ? parenthetical[1] : type;
}

/**
 * Bring a committed spec entity into the same shape `fromApi` produces, so the
 * diff compares like with like. `note` is documentation and is dropped — were
 * it kept, every entity carrying one would read as permanently drifted.
 */
function specToCanonical(entity, knownTriggerNames) {
  const out = {};
  for (const [k, v] of Object.entries(entity)) {
    if (k === 'note' || k === 'consentSettings') continue;
    out[k] = k === 'type' ? normalizeType(v) : v;
  }
  // `knownTriggerNames` is every trigger the workspace has plus every trigger
  // this spec declares — a trigger created later in the same run is not a
  // built-in, it just does not exist yet.
  if (knownTriggerNames && out.firingTrigger && !knownTriggerNames.has(out.firingTrigger)) {
    out.firingTrigger = BUILT_IN_TRIGGER;
  }
  if (out.configSettings) {
    // The specs write `send_page_view: false`; the API stores the string
    // "false". Uncompared, the Config tag reads as drifted on every run.
    out.configSettings = Object.fromEntries(
      Object.entries(out.configSettings).map(([k, v]) => [k, String(v)]),
    );
  }
  if (entity.consentSettings) {
    out.consentRequired = Object.entries(entity.consentSettings)
      .filter(([k, v]) => k !== 'note' && v === 'required')
      .map(([k]) => k);
  }
  return out;
}

module.exports = {
  BUILT_IN_TRIGGER,
  specToCanonical,
  consentToApi,
  consentFromApi,
  normalizeType,
  tagFromApi,
  tagToApi,
  triggerFromApi,
  triggerToApi,
  variableFromApi,
  variableToApi,
};
