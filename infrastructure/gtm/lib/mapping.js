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
  spec.consentRequired = consentFromApi(api.consentSettings);
  return spec;
}

function tagToApi(spec, ctx, existing) {
  let id = (ctx.triggerIdByName || {})[spec.firingTrigger];
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
  const parameter = [bindingsToApi(spec.parameters)];
  if (spec.eventName) parameter.push(template('eventName', spec.eventName));
  if (spec.measurementId) parameter.push(template('measurementIdOverride', spec.measurementId));

  return {
    name: spec.name,
    type: spec.type,
    parameter,
    firingTriggerId: [id],
    consentSettings: consentToApi(spec.consentRequired),
  };
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
function specToCanonical(entity) {
  const out = {};
  for (const [k, v] of Object.entries(entity)) {
    if (k === 'note' || k === 'consentSettings') continue;
    out[k] = k === 'type' ? normalizeType(v) : v;
  }
  if (entity.consentSettings) {
    out.consentRequired = Object.entries(entity.consentSettings)
      .filter(([k, v]) => k !== 'note' && v === 'required')
      .map(([k]) => k);
  }
  return out;
}

module.exports = {
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
