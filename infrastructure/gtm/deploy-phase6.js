#!/usr/bin/env node
/**
 * Phase 6 GTM Deployment Script
 *
 * Creates demo event variables, triggers, and tags in both the web GTM
 * and sGTM containers via the Tag Manager API, then publishes both.
 *
 * Prerequisites:
 *   - GOOGLE_APPLICATION_CREDENTIALS pointing to a service account key
 *   - Service account has Tag Manager edit permissions on the account
 *   - google-auth-library installed
 *
 * Usage: node deploy-phase6.js [--dry-run]
 */

const { GoogleAuth } = require('google-auth-library');

const DRY_RUN = process.argv.includes('--dry-run');

// Container paths
const ACCOUNT_ID = '6346433751';
const WEB_CONTAINER_ID = '247511905';
const WEB_WORKSPACE_ID = '7';
const SGTM_CONTAINER_ID = '247531845';
const SGTM_WORKSPACE_ID = '13';

const WEB_BASE = `https://www.googleapis.com/tagmanager/v2/accounts/${ACCOUNT_ID}/containers/${WEB_CONTAINER_ID}/workspaces/${WEB_WORKSPACE_ID}`;
const SGTM_BASE = `https://www.googleapis.com/tagmanager/v2/accounts/${ACCOUNT_ID}/containers/${SGTM_CONTAINER_ID}/workspaces/${SGTM_WORKSPACE_ID}`;

// Existing folder IDs (from live container)
const WEB_DLV_FOLDER = '35'; // "Data Layer Variables"
const WEB_GA4_FOLDER = '39'; // "GA4 Tags & Config"

// ─── Phase 6 Data Layer Variables (web container) ────────────────────────────
const PHASE6_DLV_NAMES = [
  'product_id',
  'product_name',
  'product_price',
  'product_category',
  'quantity',
  'cart_total',
  'item_count',
  'order_id',
  'order_total',
  'products',
  'plan_id',
  'plan_name',
  'plan_price',
  'partnership_type',
  'budget_range',
  'company_name',
  'lead_id',
  'qualification_tier',
];

// ─── Phase 6 Triggers (web container) ────────────────────────────────────────
const PHASE6_TRIGGER_EVENTS = [
  'product_view',
  'add_to_cart',
  'begin_checkout',
  'purchase',
  'plan_select',
  'trial_signup',
  'form_complete',
  'lead_qualify',
];

// ─── Phase 6 GA4 Event Tags (web container) ─────────────────────────────────
// Each tag maps event-specific parameters. Base params come from shared_event_settings.
const PHASE6_TAGS = [
  {
    name: 'GA4 - product_view',
    eventName: 'product_view',
    triggerEvent: 'product_view',
    params: [
      ['product_id', 'dlv - product_id'],
      ['product_name', 'dlv - product_name'],
      ['product_price', 'dlv - product_price'],
      ['product_category', 'dlv - product_category'],
    ],
  },
  {
    name: 'GA4 - add_to_cart',
    eventName: 'add_to_cart',
    triggerEvent: 'add_to_cart',
    params: [
      ['product_id', 'dlv - product_id'],
      ['product_name', 'dlv - product_name'],
      ['product_price', 'dlv - product_price'],
      ['quantity', 'dlv - quantity'],
    ],
  },
  {
    name: 'GA4 - begin_checkout',
    eventName: 'begin_checkout',
    triggerEvent: 'begin_checkout',
    params: [
      ['cart_total', 'dlv - cart_total'],
      ['item_count', 'dlv - item_count'],
    ],
  },
  {
    name: 'GA4 - purchase',
    eventName: 'purchase',
    triggerEvent: 'purchase',
    params: [
      ['order_id', 'dlv - order_id'],
      ['order_total', 'dlv - order_total'],
      ['item_count', 'dlv - item_count'],
      ['products', 'dlv - products'],
    ],
  },
  {
    name: 'GA4 - plan_select',
    eventName: 'plan_select',
    triggerEvent: 'plan_select',
    params: [
      ['plan_id', 'dlv - plan_id'],
      ['plan_name', 'dlv - plan_name'],
      ['plan_price', 'dlv - plan_price'],
    ],
  },
  {
    name: 'GA4 - trial_signup',
    eventName: 'trial_signup',
    triggerEvent: 'trial_signup',
    params: [
      ['plan_id', 'dlv - plan_id'],
      ['plan_name', 'dlv - plan_name'],
      ['plan_price', 'dlv - plan_price'],
    ],
  },
  {
    name: 'GA4 - form_complete',
    eventName: 'form_complete',
    triggerEvent: 'form_complete',
    params: [
      ['form_name', 'dlv - form_name'],
      ['partnership_type', 'dlv - partnership_type'],
      ['budget_range', 'dlv - budget_range'],
      ['company_name', 'dlv - company_name'],
    ],
  },
  {
    name: 'GA4 - lead_qualify',
    eventName: 'lead_qualify',
    triggerEvent: 'lead_qualify',
    params: [
      ['lead_id', 'dlv - lead_id'],
      ['qualification_tier', 'dlv - qualification_tier'],
      ['partnership_type', 'dlv - partnership_type'],
      ['budget_range', 'dlv - budget_range'],
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
    consentSettings: { consentStatus: 'notNeeded' },
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const auth = new GoogleAuth({
    scopes: [
      'https://www.googleapis.com/auth/tagmanager.edit.containers',
      'https://www.googleapis.com/auth/tagmanager.publish',
      'https://www.googleapis.com/auth/tagmanager.manage.accounts',
    ],
  });
  const client = await auth.getClient();

  async function apiPost(url, body) {
    if (DRY_RUN) {
      console.log(`  [DRY RUN] POST ${url.split('/workspaces/')[1]}`);
      return {
        data: { name: body.name, triggerId: 'dry-run', variableId: 'dry-run', tagId: 'dry-run' },
      };
    }
    const res = await client.request({ url, method: 'POST', data: body });
    return res;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Phase 6 GTM Deployment${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log(`${'='.repeat(60)}\n`);

  // ── Step 1: Create Phase 6 DLV variables in web container ──────────────

  console.log('Step 1: Creating 18 data layer variables in web container...');
  for (const dlvName of PHASE6_DLV_NAMES) {
    const body = buildDLVBody(dlvName, WEB_DLV_FOLDER);
    try {
      const res = await apiPost(`${WEB_BASE}/variables`, body);
      console.log(`  ✓ ${res.data.name} (id: ${res.data.variableId})`);
    } catch (e) {
      if (e.response && e.response.status === 400 && e.message.includes('already exists')) {
        console.log(`  ⊘ dlv - ${dlvName} (already exists, skipping)`);
      } else {
        console.error(`  ✗ dlv - ${dlvName}: ${e.message}`);
        throw e;
      }
    }
  }

  // ── Step 2: Create Phase 6 triggers in web container ───────────────────

  console.log('\nStep 2: Creating 8 custom event triggers in web container...');
  const triggerIdMap = {};
  for (const eventName of PHASE6_TRIGGER_EVENTS) {
    const body = buildCustomEventTriggerBody(eventName);
    try {
      const res = await apiPost(`${WEB_BASE}/triggers`, body);
      triggerIdMap[eventName] = res.data.triggerId;
      console.log(`  ✓ ${res.data.name} (id: ${res.data.triggerId})`);
    } catch (e) {
      if (e.response && e.response.status === 400 && e.message.includes('already exists')) {
        console.log(`  ⊘ ce - ${eventName} (already exists, need to look up ID)`);
        // Fetch existing triggers to get the ID
        const existing = await client.request({ url: `${WEB_BASE}/triggers` });
        const found = existing.data.trigger.find((t) => t.name === `ce - ${eventName}`);
        if (found) {
          triggerIdMap[eventName] = found.triggerId;
          console.log(`    → found existing trigger ID: ${found.triggerId}`);
        }
      } else {
        console.error(`  ✗ ce - ${eventName}: ${e.message}`);
        throw e;
      }
    }
  }

  // ── Step 3: Create Phase 6 GA4 event tags in web container ─────────────

  console.log('\nStep 3: Creating 8 GA4 event tags in web container...');
  for (const tagDef of PHASE6_TAGS) {
    const body = buildGA4EventTagBody(tagDef, triggerIdMap, WEB_GA4_FOLDER);
    try {
      const res = await apiPost(`${WEB_BASE}/tags`, body);
      console.log(`  ✓ ${res.data.name} (id: ${res.data.tagId})`);
    } catch (e) {
      if (e.response && e.response.status === 400 && e.message.includes('already exists')) {
        console.log(`  ⊘ ${tagDef.name} (already exists, skipping)`);
      } else {
        console.error(`  ✗ ${tagDef.name}: ${e.message}`);
        throw e;
      }
    }
  }

  // ── Step 4: Create sGTM conversions trigger ────────────────────────────

  console.log('\nStep 4: Creating conversions trigger in sGTM container...');
  let conversionTriggerId;
  {
    const body = {
      name: 'ce - conversions',
      type: 'always',
      filter: [
        {
          type: 'contains',
          parameter: [
            { type: 'template', key: 'arg0', value: '{{Client Name}}' },
            { type: 'template', key: 'arg1', value: 'GA4' },
          ],
        },
        {
          type: 'matchRegex',
          parameter: [
            { type: 'template', key: 'arg0', value: '{{Event Name}}' },
            { type: 'template', key: 'arg1', value: '^(purchase|trial_signup|form_complete)$' },
          ],
        },
      ],
    };
    try {
      const res = await apiPost(`${SGTM_BASE}/triggers`, body);
      conversionTriggerId = res.data.triggerId;
      console.log(`  ✓ ${res.data.name} (id: ${conversionTriggerId})`);
    } catch (e) {
      if (e.response && e.response.status === 400) {
        console.log(`  ⊘ ce - conversions (may already exist, looking up...)`);
        const existing = await client.request({ url: `${SGTM_BASE}/triggers` });
        const found = existing.data.trigger.find((t) => t.name === 'ce - conversions');
        if (found) {
          conversionTriggerId = found.triggerId;
          console.log(`    → found existing trigger ID: ${found.triggerId}`);
        }
      } else {
        throw e;
      }
    }
  }

  // ── Step 5: Create sGTM simulated ad platform tags ─────────────────────

  console.log('\nStep 5: Creating simulated ad platform tags in sGTM container...');

  // First, create a folder for Phase 6 tags
  let phase6FolderId;
  try {
    const folderRes = await apiPost(`${SGTM_BASE}/folders`, {
      name: 'Phase 6 - Simulated Ad Platforms',
    });
    phase6FolderId = folderRes.data.folderId;
    console.log(`  ✓ Folder: Phase 6 - Simulated Ad Platforms (id: ${phase6FolderId})`);
  } catch (e) {
    console.log(`  ⊘ Folder may exist, continuing without folder assignment`);
  }

  // Create a custom template for Meta CAPI simulation
  console.log('\n  Creating sGTM template: Meta CAPI Simulation...');
  let metaTemplateId;
  {
    const templateBody = {
      name: 'Meta CAPI - Simulation',
      sectionDisabled: {},
      templateData: `___TERMS_OF_SERVICE___
By creating or modifying this file you agree to Google Tag Manager's Community Template Gallery Developer Terms of Service available at https://developers.google.com/tag-manager/gallery-tos (or such other URL as Google may provide), as modified from time to time.

___INFO___
{
  "type": "TAG",
  "id": "meta_capi_sim",
  "version": 1,
  "securityGroups": [],
  "displayName": "Meta CAPI - Simulation",
  "brand": {
    "id": "iampatterson",
    "displayName": "iampatterson.com"
  },
  "description": "Simulates Meta Conversions API payloads. Logs the payload that would be sent to Meta without making an HTTP request.",
  "containerContexts": ["SERVER"]
}

___TEMPLATE_PARAMETERS___
[]

___SANDBOXED_JS_FOR_SERVER___
const getAllEventData = require('getAllEventData');
const getEventData = require('getEventData');
const logToConsole = require('logToConsole');
const getTimestampMillis = require('getTimestampMillis');

const eventData = getAllEventData();
const eventName = getEventData('event_name');

// Map GTM event names to Meta standard events
const eventMap = {
  'purchase': 'Purchase',
  'add_to_cart': 'AddToCart',
  'begin_checkout': 'InitiateCheckout',
  'trial_signup': 'StartTrial',
  'form_complete': 'Lead',
  'product_view': 'ViewContent',
  'page_view': 'PageView'
};

const metaEventName = eventMap[eventName] || eventName;

const payload = {
  event_name: metaEventName,
  event_time: getTimestampMillis(),
  event_source_url: getEventData('page_location'),
  action_source: 'website',
  user_data: {
    client_ip_address: '[REDACTED]',
    client_user_agent: getEventData('user_agent') || '[SIMULATED]',
    fbc: '[SIMULATED_FBC]',
    fbp: '[SIMULATED_FBP]',
    em: '[HASHED_EMAIL_PLACEHOLDER]'
  },
  custom_data: {
    currency: 'USD',
    value: getEventData('order_total') || getEventData('plan_price') || '0.00',
    content_name: getEventData('product_name') || getEventData('plan_name') || '',
    content_ids: [getEventData('product_id') || getEventData('order_id') || ''],
    content_type: 'product'
  }
};

logToConsole('[META CAPI SIMULATED] Event: ' + metaEventName);
logToConsole('[META CAPI SIMULATED] Payload: ' + JSON.stringify(payload));

data.gtmOnSuccess();

___TESTS___
scenarios: []
`,
    };
    try {
      const res = await apiPost(`${SGTM_BASE}/templates`, templateBody);
      metaTemplateId = res.data.templateId;
      console.log(`  ✓ Template: Meta CAPI - Simulation (id: ${metaTemplateId})`);
    } catch (e) {
      console.error(
        `  ✗ Meta template: ${e.response ? JSON.stringify(e.response.data).substring(0, 200) : e.message}`,
      );
    }
  }

  // Create a custom template for Google Ads EC simulation
  console.log('  Creating sGTM template: Google Ads EC Simulation...');
  let gadsTemplateId;
  {
    const templateBody = {
      name: 'Google Ads EC - Simulation',
      sectionDisabled: {},
      templateData: `___TERMS_OF_SERVICE___
By creating or modifying this file you agree to Google Tag Manager's Community Template Gallery Developer Terms of Service available at https://developers.google.com/tag-manager/gallery-tos (or such other URL as Google may provide), as modified from time to time.

___INFO___
{
  "type": "TAG",
  "id": "gads_ec_sim",
  "version": 1,
  "securityGroups": [],
  "displayName": "Google Ads EC - Simulation",
  "brand": {
    "id": "iampatterson",
    "displayName": "iampatterson.com"
  },
  "description": "Simulates Google Ads Enhanced Conversions payloads. Logs the conversion payload without making an HTTP request.",
  "containerContexts": ["SERVER"]
}

___TEMPLATE_PARAMETERS___
[]

___SANDBOXED_JS_FOR_SERVER___
const getAllEventData = require('getAllEventData');
const getEventData = require('getEventData');
const logToConsole = require('logToConsole');
const getTimestampMillis = require('getTimestampMillis');

const eventData = getAllEventData();
const eventName = getEventData('event_name');

const payload = {
  conversion_action: 'conversions/' + eventName,
  conversion_date_time: getTimestampMillis(),
  conversion_value: getEventData('order_total') || getEventData('plan_price') || '0.00',
  currency_code: 'USD',
  order_id: getEventData('order_id') || '',
  user_identifiers: {
    hashed_email: '[SHA256_EMAIL_PLACEHOLDER]',
    hashed_phone_number: '[SHA256_PHONE_PLACEHOLDER]',
    address_info: {
      hashed_first_name: '[SHA256_FIRST_NAME_PLACEHOLDER]',
      hashed_last_name: '[SHA256_LAST_NAME_PLACEHOLDER]'
    }
  },
  custom_variables: {
    event_name: eventName,
    plan_name: getEventData('plan_name') || '',
    product_name: getEventData('product_name') || '',
    qualification_tier: getEventData('qualification_tier') || ''
  }
};

logToConsole('[GOOGLE ADS EC SIMULATED] Event: ' + eventName);
logToConsole('[GOOGLE ADS EC SIMULATED] Payload: ' + JSON.stringify(payload));

data.gtmOnSuccess();

___TESTS___
scenarios: []
`,
    };
    try {
      const res = await apiPost(`${SGTM_BASE}/templates`, templateBody);
      gadsTemplateId = res.data.templateId;
      console.log(`  ✓ Template: Google Ads EC - Simulation (id: ${gadsTemplateId})`);
    } catch (e) {
      console.error(
        `  ✗ GAds template: ${e.response ? JSON.stringify(e.response.data).substring(0, 200) : e.message}`,
      );
    }
  }

  // Create Meta CAPI simulated tag
  if (metaTemplateId && conversionTriggerId) {
    const body = {
      name: 'Meta CAPI - Simulated',
      type: `cvt_${SGTM_CONTAINER_ID}_${metaTemplateId}`,
      parameter: [],
      firingTriggerId: [conversionTriggerId],
      tagFiringOption: 'oncePerEvent',
      monitoringMetadata: { type: 'map' },
      consentSettings: { consentStatus: 'notNeeded' },
    };
    if (phase6FolderId) body.parentFolderId = phase6FolderId;
    try {
      const res = await apiPost(`${SGTM_BASE}/tags`, body);
      console.log(`  ✓ Tag: ${res.data.name} (id: ${res.data.tagId})`);
    } catch (e) {
      console.error(
        `  ✗ Meta tag: ${e.response ? JSON.stringify(e.response.data).substring(0, 200) : e.message}`,
      );
    }
  }

  // Create Google Ads EC simulated tag
  if (gadsTemplateId && conversionTriggerId) {
    const body = {
      name: 'Google Ads Enhanced Conversions - Simulated',
      type: `cvt_${SGTM_CONTAINER_ID}_${gadsTemplateId}`,
      parameter: [],
      firingTriggerId: [conversionTriggerId],
      tagFiringOption: 'oncePerEvent',
      monitoringMetadata: { type: 'map' },
      consentSettings: { consentStatus: 'notNeeded' },
    };
    if (phase6FolderId) body.parentFolderId = phase6FolderId;
    try {
      const res = await apiPost(`${SGTM_BASE}/tags`, body);
      console.log(`  ✓ Tag: ${res.data.name} (id: ${res.data.tagId})`);
    } catch (e) {
      console.error(
        `  ✗ GAds tag: ${e.response ? JSON.stringify(e.response.data).substring(0, 200) : e.message}`,
      );
    }
  }

  // ── Step 6: Publish both containers ────────────────────────────────────

  console.log('\nStep 6: Publishing containers...');

  if (DRY_RUN) {
    console.log('  [DRY RUN] Would create version and publish web container');
    console.log('  [DRY RUN] Would create version and publish sGTM container');
  } else {
    // Create version and publish web container
    try {
      const webVersion = await client.request({
        url: `${WEB_BASE}:create_version`,
        method: 'POST',
        data: {
          name: 'Phase 6 - Demo Event Tags',
          notes:
            'Added 18 DLV variables, 8 triggers, 8 GA4 event tags for e-commerce, subscription, and lead gen demos.',
        },
      });
      const versionId = webVersion.data.containerVersion.containerVersionId;
      console.log(`  ✓ Web container version created: ${versionId}`);

      const publishRes = await client.request({
        url: `https://www.googleapis.com/tagmanager/v2/accounts/${ACCOUNT_ID}/containers/${WEB_CONTAINER_ID}/versions/${versionId}:publish`,
        method: 'POST',
      });
      console.log(`  ✓ Web container published! Version: ${versionId}`);
    } catch (e) {
      console.error(
        `  ✗ Web publish: ${e.response ? JSON.stringify(e.response.data).substring(0, 300) : e.message}`,
      );
    }

    // Create version and publish sGTM container
    try {
      const sgtmVersion = await client.request({
        url: `${SGTM_BASE}:create_version`,
        method: 'POST',
        data: {
          name: 'Phase 6 - Simulated Ad Platform Tags',
          notes:
            'Added conversions trigger, Meta CAPI simulation tag, Google Ads EC simulation tag with custom sGTM templates.',
        },
      });
      const versionId = sgtmVersion.data.containerVersion.containerVersionId;
      console.log(`  ✓ sGTM container version created: ${versionId}`);

      const publishRes = await client.request({
        url: `https://www.googleapis.com/tagmanager/v2/accounts/${ACCOUNT_ID}/containers/${SGTM_CONTAINER_ID}/versions/${versionId}:publish`,
        method: 'POST',
      });
      console.log(`  ✓ sGTM container published! Version: ${versionId}`);
    } catch (e) {
      console.error(
        `  ✗ sGTM publish: ${e.response ? JSON.stringify(e.response.data).substring(0, 300) : e.message}`,
      );
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('Phase 6 GTM deployment complete!');
  console.log(`${'='.repeat(60)}\n`);
}

main().catch((e) => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
