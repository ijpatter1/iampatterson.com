#!/usr/bin/env node
/**
 * Claudish GTM Deployment Script (feat/claudish M6)
 *
 * Creates the four claudish_* event pipelines in the WEB container
 * (DLVs, customEvent triggers, GA4 event tags gated on
 * analytics_storage). The server container needs no changes — its
 * All-GA4-Events trigger forwards claudish events generically
 * (asserted by tests/integration/claudish-container-spec.test.ts).
 *
 * The ?t= privacy strip is deliberately NOT here: a config-level
 * page_location override freezes every SPA hit at the entry URL
 * (the config tag fires once per full page load — adversarial review
 * 2026-08-31). The strip is a parse-time inline script in
 * src/app/claudish/layout.tsx. If GTM-side cleaning is ever wanted,
 * the per-hit home is the gtes shared_event_settings variable, never
 * configSettingsTable. (No live cleanup needed: this script's earlier
 * page_location step was never run against the live container.)
 *
 * Prerequisites: GOOGLE_APPLICATION_CREDENTIALS with Tag Manager edit
 * permissions (same setup as deploy-phase6.js).
 *
 * Usage: node deploy-claudish.js [--dry-run] [--publish]
 *   default: creates workspace changes, does NOT publish
 *   --publish: also creates a version and publishes the web container
 */

const { GoogleAuth } = require('google-auth-library');

const DRY_RUN = process.argv.includes('--dry-run');
const PUBLISH = process.argv.includes('--publish');

const ACCOUNT_ID = '6346433751';
const WEB_CONTAINER_ID = '247511905';
const CONTAINERS_BASE = `https://www.googleapis.com/tagmanager/v2/accounts/${ACCOUNT_ID}/containers`;

// Existing folder IDs (from live container; deploy-phase6.js precedent).
const WEB_DLV_FOLDER = '35'; // "Data Layer Variables"
const WEB_GA4_FOLDER = '39'; // "GA4 Tags & Config"

// ─── Claudish event allow-lists (mirrored by the container spec test) ───────

const CLAUDISH_DLV_NAMES = [
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
  'share_action',
  'share_truncated',
  'share_url_chars',
  'rating',
];

const CLAUDISH_TRIGGER_EVENTS = [
  'claudish_translate',
  'claudish_detected',
  'claudish_share',
  'claudish_rate',
];

const CLAUDISH_TAGS = [
  {
    name: 'GA4 - claudish_translate',
    eventName: 'claudish_translate',
    triggerEvent: 'claudish_translate',
    params: [
      ['direction', 'dlv - direction'],
      ['source_mode', 'dlv - source_mode'],
      ['detected_language', 'dlv - detected_language'],
      ['detector_source', 'dlv - detector_source'],
      ['outcome', 'dlv - outcome'],
      ['input_chars', 'dlv - input_chars'],
      ['input_em_dashes', 'dlv - input_em_dashes'],
      ['output_chars', 'dlv - output_chars'],
      ['ttft_ms', 'dlv - ttft_ms'],
      ['duration_ms', 'dlv - duration_ms'],
      ['cache', 'dlv - cache'],
    ],
  },
  {
    name: 'GA4 - claudish_detected',
    eventName: 'claudish_detected',
    triggerEvent: 'claudish_detected',
    params: [
      ['detected_language', 'dlv - detected_language'],
      ['detector_source', 'dlv - detector_source'],
      ['input_chars', 'dlv - input_chars'],
    ],
  },
  {
    name: 'GA4 - claudish_share',
    eventName: 'claudish_share',
    triggerEvent: 'claudish_share',
    params: [
      ['share_action', 'dlv - share_action'],
      ['direction', 'dlv - direction'],
      ['output_chars', 'dlv - output_chars'],
      ['share_truncated', 'dlv - share_truncated'],
      ['share_url_chars', 'dlv - share_url_chars'],
    ],
  },
  {
    name: 'GA4 - claudish_rate',
    eventName: 'claudish_rate',
    triggerEvent: 'claudish_rate',
    params: [
      ['rating', 'dlv - rating'],
      ['direction', 'dlv - direction'],
      ['output_chars', 'dlv - output_chars'],
    ],
  },
];

// ─── Body builders (deploy-phase6.js shapes) ────────────────────────────────

function buildDLVBody(dlvName, folderId) {
  return {
    name: `dlv - ${dlvName}`,
    type: 'v',
    parameter: [
      { type: 'integer', key: 'dataLayerVersion', value: '2' },
      { type: 'boolean', key: 'setDefaultValue', value: 'false' },
      { type: 'template', key: 'name', value: dlvName },
    ],
    parentFolderId: folderId,
  };
}

function buildCustomEventTriggerBody(eventName) {
  return {
    name: `ce - ${eventName}`,
    type: 'customEvent',
    customEventFilter: [
      {
        type: 'equals',
        parameter: [
          { type: 'template', key: 'arg0', value: '{{_event}}' },
          { type: 'template', key: 'arg1', value: eventName },
        ],
      },
    ],
  };
}

function buildGA4EventTagBody(tagDef, triggerIdMap, folderId) {
  const triggerId = triggerIdMap[tagDef.triggerEvent];
  if (!triggerId) throw new Error(`Trigger not found for event: ${tagDef.triggerEvent}`);
  const eventSettingsTable = tagDef.params.map(([paramName, varName]) => ({
    type: 'map',
    map: [
      { type: 'template', key: 'parameter', value: paramName },
      { type: 'template', key: 'parameterValue', value: `{{${varName}}}` },
    ],
  }));
  return {
    name: tagDef.name,
    type: 'gaawe',
    parameter: [
      { type: 'boolean', key: 'sendEcommerceData', value: 'false' },
      { type: 'list', key: 'eventSettingsTable', list: eventSettingsTable },
      { type: 'template', key: 'eventName', value: tagDef.eventName },
      { type: 'template', key: 'measurementIdOverride', value: '{{const - ga4_measurement_id}}' },
      { type: 'template', key: 'eventSettingsVariable', value: '{{ga4 - shared_event_settings}}' },
    ],
    firingTriggerId: [triggerId],
    parentFolderId: folderId,
    tagFiringOption: 'oncePerEvent',
    monitoringMetadata: { type: 'map' },
    // Gated, matching the container spec (analytics_storage required).
    consentSettings: {
      consentStatus: 'needed',
      consentType: { type: 'list', list: [{ type: 'template', value: 'analytics_storage' }] },
    },
  };
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const auth = new GoogleAuth({
    scopes: [
      'https://www.googleapis.com/auth/tagmanager.edit.containers',
      'https://www.googleapis.com/auth/tagmanager.edit.containerversions',
      'https://www.googleapis.com/auth/tagmanager.publish',
      'https://www.googleapis.com/auth/tagmanager.manage.accounts',
    ],
  });
  const client = await auth.getClient();

  const wsRes = await client.request({
    url: `${CONTAINERS_BASE}/${WEB_CONTAINER_ID}/workspaces`,
  });
  const ws = (wsRes.data.workspace || []).find((w) => w.name === 'Default Workspace');
  if (!ws) throw new Error('No "Default Workspace" on the web container');
  const WEB_BASE = `${CONTAINERS_BASE}/${WEB_CONTAINER_ID}/workspaces/${ws.workspaceId}`;
  console.log(`Resolved web workspace: ${ws.workspaceId}`);

  async function apiPost(url, body) {
    if (DRY_RUN) {
      console.log(`  [DRY RUN] POST ${url.split('/workspaces/')[1]}: ${body.name}`);
      return { data: { name: body.name, triggerId: 'dry-run', variableId: 'dry-run', tagId: 'dry-run' } };
    }
    return client.request({ url, method: 'POST', data: body });
  }

  const tolerateExists = async (fn, label, onExists) => {
    try {
      return await fn();
    } catch (e) {
      if (e.response && e.response.status === 400 && String(e.message).includes('already exists')) {
        console.log(`  ⊘ ${label} (already exists)`);
        return onExists ? onExists() : null;
      }
      throw e;
    }
  };

  console.log(`\nStep 1: ${CLAUDISH_DLV_NAMES.length} data layer variables...`);
  for (const dlvName of CLAUDISH_DLV_NAMES) {
    await tolerateExists(
      async () => {
        const res = await apiPost(`${WEB_BASE}/variables`, buildDLVBody(dlvName, WEB_DLV_FOLDER));
        console.log(`  ✓ ${res.data.name}`);
      },
      `dlv - ${dlvName}`
    );
  }

  console.log(`\nStep 2: ${CLAUDISH_TRIGGER_EVENTS.length} custom event triggers...`);
  const triggerIdMap = {};
  for (const eventName of CLAUDISH_TRIGGER_EVENTS) {
    await tolerateExists(
      async () => {
        const res = await apiPost(`${WEB_BASE}/triggers`, buildCustomEventTriggerBody(eventName));
        triggerIdMap[eventName] = res.data.triggerId;
        console.log(`  ✓ ${res.data.name}`);
      },
      `ce - ${eventName}`,
      async () => {
        const existing = await client.request({ url: `${WEB_BASE}/triggers` });
        const found = (existing.data.trigger || []).find((t) => t.name === `ce - ${eventName}`);
        if (found) triggerIdMap[eventName] = found.triggerId;
      }
    );
  }

  console.log(`\nStep 3: ${CLAUDISH_TAGS.length} GA4 event tags...`);
  for (const tagDef of CLAUDISH_TAGS) {
    await tolerateExists(
      async () => {
        const res = await apiPost(`${WEB_BASE}/tags`, buildGA4EventTagBody(tagDef, triggerIdMap, WEB_GA4_FOLDER));
        console.log(`  ✓ ${res.data.name}`);
      },
      tagDef.name
    );
  }

  if (PUBLISH && !DRY_RUN) {
    console.log('\nStep 4: version + publish (web container)...');
    const versionRes = await client.request({
      url: `${WEB_BASE}:create_version`,
      method: 'POST',
      data: { name: 'feat/claudish events' },
    });
    const versionId = versionRes.data.containerVersion.containerVersionId;
    await client.request({
      url: `${CONTAINERS_BASE}/${WEB_CONTAINER_ID}/versions/${versionId}:publish`,
      method: 'POST',
    });
    console.log(`  ✓ published version ${versionId}`);
  } else {
    console.log('\nStep 4: skipped publish (run with --publish, or publish from the GTM UI)');
  }
  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
