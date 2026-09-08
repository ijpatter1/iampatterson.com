#!/usr/bin/env node
/**
 * GTM container reconciler.
 *
 * Diffs the committed container specs against the live Default Workspace and,
 * when asked, converges live onto them. Replaces the one-shot deploy scripts
 * (`deploy-phase6.js`, `deploy-claudish.js`), which each wrote a hard-coded
 * list of entities and could not report what was already there.
 *
 * Three distinct steps, each opt-in past the last:
 *
 *   node reconcile.js                          # dry run, both containers
 *   node reconcile.js --container=web --apply  # write adds and updates
 *   node reconcile.js --container=web --apply --publish
 *
 * Deletes need `--allow-deletes` on top of `--apply`. A workspace change is
 * invisible to visitors until a version is published, so `--apply` alone is
 * safe to run and inspect in the GTM UI before publishing.
 *
 * Credentials: a bearer token in GTM_TOKEN, or minted here by impersonating
 * gtm-reconciler@iampatterson.iam.gserviceaccount.com. That account is a
 * member of GTM account 6346433751, which is what the Tag Manager API
 * authorizes on — GCP IAM alone grants nothing here. There is no key.
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { createClient } = require('./lib/client.js');
const { reconcile } = require('./lib/reconcile-core.js');
const { OWNED } = require('./lib/diff.js');
const { tagFromApi, triggerFromApi, variableFromApi } = require('./lib/mapping.js');

const ACCOUNT_ID = '6346433751';
const CONTAINERS = {
  web: { id: '247511905', spec: 'web-container.json' },
  server: { id: '247531845', spec: 'server-container.json' },
};

const SERVICE_ACCOUNT = 'gtm-reconciler@iampatterson.iam.gserviceaccount.com';
const READ_SCOPE = 'https://www.googleapis.com/auth/tagmanager.readonly';
const WRITE_SCOPES = [
  'https://www.googleapis.com/auth/tagmanager.edit.containers',
  'https://www.googleapis.com/auth/tagmanager.edit.containerversions',
  'https://www.googleapis.com/auth/tagmanager.publish',
  READ_SCOPE,
].join(',');

/**
 * Flags, with the safe value as every default. `apply`, `allowDeletes` and
 * `publish` are each off unless named, so the worst a bare invocation can do
 * is read.
 */
function parseArgs(argv) {
  const opts = {
    containers: ['web', 'server'],
    apply: false,
    allowDeletes: false,
    publish: false,
    capture: false,
  };
  let named = false;
  for (const arg of argv) {
    if (arg === '--apply') opts.apply = true;
    else if (arg === '--allow-deletes') opts.allowDeletes = true;
    else if (arg === '--publish') opts.publish = true;
    else if (arg === '--capture') opts.capture = true;
    else if (arg.startsWith('--container=')) {
      const which = arg.slice('--container='.length);
      named = which !== 'both';
      if (which === 'both') opts.containers = ['web', 'server'];
      else if (CONTAINERS[which]) opts.containers = [which];
      else throw new Error(`unknown container "${which}"; expected web, server or both`);
    } else if (arg.startsWith('--')) {
      throw new Error(`unknown flag "${arg}"`);
    }
  }
  if (opts.publish && !opts.apply) {
    throw new Error('--publish requires --apply; there is nothing to publish from a dry run');
  }
  // Reading both containers is harmless; writing to one you did not name is
  // not. The 2026-09-08 census found server-container.json describes a
  // container that was planned and never built, so a bare `--apply` would
  // have created nine triggers and five malformed tags in a working pipeline.
  if ((opts.apply || opts.capture) && !named) {
    throw new Error(
      'writing needs an explicit --container=web or --container=server; refusing to act on a container you did not name',
    );
  }
  return opts;
}

function token(needsWrite) {
  if (process.env.GTM_TOKEN) return process.env.GTM_TOKEN;
  // print-access-token takes no --project flag and the CLI default is the
  // wrong project, so the quota project is set through the environment.
  return execFileSync(
    'gcloud',
    [
      'auth',
      'print-access-token',
      `--impersonate-service-account=${SERVICE_ACCOUNT}`,
      `--scopes=${needsWrite ? WRITE_SCOPES : READ_SCOPE}`,
    ],
    { encoding: 'utf8', env: { ...process.env, CLOUDSDK_CORE_PROJECT: 'iampatterson' } },
  ).trim();
}

const specPath = (name) => path.join(__dirname, CONTAINERS[name].spec);

function report(name, diff) {
  const { totals } = diff;
  console.log(`\n── ${name} container ${'─'.repeat(46)}`);
  if (!diff.changed) {
    console.log('  no drift');
    return;
  }
  for (const collection of OWNED) {
    const d = diff.collections[collection];
    if (!d.changed) continue;
    console.log(`  ${collection}:`);
    for (const e of d.adds) console.log(`    + ${e.name}`);
    for (const u of d.updates) console.log(`    ~ ${u.name}  (${u.fields.join(', ')})`);
    for (const e of d.deletes) console.log(`    - ${e.name}   [only removed with --allow-deletes]`);
  }
  console.log(
    `  ${totals.adds} to add, ${totals.updates} to change, ${totals.deletes} not in the spec`,
  );
}

/**
 * Write live back into the committed spec — the brownfield direction, for a
 * spec that never described its container. Captured files carry canonical API
 * type names (`gaawe`, `customEvent`) where a hand-written spec may use its
 * own labels ("GA4 Event (gaawe)"); the mapping accepts both, so the two
 * dialects coexist without the reconciler caring which it is reading.
 */
async function capture(client, name) {
  const { id } = CONTAINERS[name];
  const workspaceId = await client.defaultWorkspaceId(id);
  const raw = {};
  for (const collection of OWNED) raw[collection] = await client.list(id, workspaceId, collection);

  const ctx = { triggerNameById: {}, triggerIdByName: {} };
  for (const t of raw.triggers) {
    if (!t.triggerId) continue;
    ctx.triggerNameById[t.triggerId] = t.name;
    ctx.triggerIdByName[t.name] = t.triggerId;
  }

  const file = specPath(name);
  const existing = JSON.parse(fs.readFileSync(file, 'utf8'));
  const captured = {
    _meta: {
      ...existing._meta,
      note: `Captured from the live Default Workspace by reconcile.js --capture on ${new Date().toISOString().slice(0, 10)}. This file describes what is live; edit it to change the container, then apply.`,
    },
    variables: raw.variables.map((v) => variableFromApi(v)),
    triggers: raw.triggers.map((t) => triggerFromApi(t)),
    tags: raw.tags.map((t) => tagFromApi(t, ctx)),
  };
  fs.writeFileSync(file, `${JSON.stringify(captured, null, 2)}\n`);
  console.log(
    `captured ${name}: ${captured.variables.length} variables, ${captured.triggers.length} triggers, ${captured.tags.length} tags → ${path.relative(process.cwd(), file)}`,
  );
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const client = createClient({
    accountId: ACCOUNT_ID,
    token: token(opts.apply || opts.publish),
  });

  if (opts.capture) {
    for (const name of opts.containers) await capture(client, name);
    return;
  }

  let anyChange = false;
  let exitCode = 0;
  for (const name of opts.containers) {
    const spec = JSON.parse(fs.readFileSync(specPath(name), 'utf8'));
    const result = await reconcile({
      client,
      containerId: CONTAINERS[name].id,
      spec,
      apply: opts.apply,
      allowDeletes: opts.allowDeletes,
      publish: opts.publish,
    });
    report(name, result.diff);
    if (result.problems.length) {
      console.log('  planned writes that cannot be built:');
      for (const p of result.problems) console.log(`    ! ${p}`);
      console.log('  an apply would refuse until these are fixed.');
      exitCode = 1;
    }
    anyChange = anyChange || result.diff.changed;
    if (result.applied) console.log(`  applied to workspace ${result.workspaceId}`);
    if (result.versionId) console.log(`  published version ${result.versionId}`);
  }

  if (!opts.apply && anyChange) {
    console.log('\nDry run. Nothing was written. Re-run with --apply to converge.');
  }
  // Finding 11: a dry run whose proof failed must not read as a pass to
  // anything gating on the exit code.
  if (exitCode) process.exitCode = exitCode;
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`\n${err.message}`);
    process.exit(1);
  });
}

module.exports = { parseArgs, CONTAINERS, ACCOUNT_ID };
