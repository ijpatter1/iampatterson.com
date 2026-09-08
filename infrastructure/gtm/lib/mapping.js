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
    list: Object.entries(parameters || {}).map(([name, value]) => ({
      type: 'map',
      map: [template('parameter', name), template('parameterValue', value)],
    })),
  };
}

function tagFromApi(api, ctx) {
  const p = byKey(api.parameter);
  const spec = {
    name: api.name,
    type: api.type,
    firingTrigger: (api.firingTriggerId || []).map(
      (id) => (ctx.triggerNameById || {})[id] || id,
    )[0],
    parameters: bindingsFromApi(p.eventSettingsTable),
  };
  if (p.eventName) spec.eventName = p.eventName.value;
  if (p.measurementIdOverride) spec.measurementId = p.measurementIdOverride.value;
  if (api.consentSettings && api.consentSettings.consentStatus) {
    spec.consentStatus = api.consentSettings.consentStatus;
  }
  return spec;
}

function tagToApi(spec, ctx) {
  const id = (ctx.triggerIdByName || {})[spec.firingTrigger];
  if (!id) {
    // An empty firingTriggerId is accepted by the API and produces a tag that
    // never fires. That reads as a successful apply and is invisible until
    // someone notices the events missing, so it is a hard stop.
    throw new Error(
      `tagToApi: tag "${spec.name}" fires on trigger "${spec.firingTrigger}", which does not exist in this container`,
    );
  }
  const parameter = [bindingsToApi(spec.parameters)];
  if (spec.eventName) parameter.push(template('eventName', spec.eventName));
  if (spec.measurementId) parameter.push(template('measurementIdOverride', spec.measurementId));

  const api = { name: spec.name, type: spec.type, parameter, firingTriggerId: [id] };
  if (spec.consentStatus) api.consentSettings = { consentStatus: spec.consentStatus };
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
const VARIABLE_TYPE_TO_SPEC = { v: 'dataLayer', c: 'constant' };
const VARIABLE_TYPE_TO_API = { dataLayer: 'v', constant: 'c' };

function variableFromApi(api) {
  const p = byKey(api.parameter);
  const spec = { name: api.name, type: VARIABLE_TYPE_TO_SPEC[api.type] || api.type };
  if (api.type === 'v' && p.name) spec.dataLayerVariable = p.name.value;
  if (api.type === 'c' && p.value) spec.value = p.value.value;
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
  }
  return api;
}

module.exports = {
  tagFromApi,
  tagToApi,
  triggerFromApi,
  triggerToApi,
  variableFromApi,
  variableToApi,
};
