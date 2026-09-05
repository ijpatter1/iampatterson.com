/**
 * @jest-environment node
 *
 * Deliverable 13.7 — the state reconciliation, pinned.
 *
 * From 2026-06-08 to 2026-09-05 the remote state held six resources that no
 * `.tf` file described: the four BigQuery datasets and the Pub/Sub topic and
 * push subscription, imported by a session that never committed their
 * configuration. `terraform plan` therefore proposed to destroy them, and an
 * apply would have stopped events reaching event-stream and BigQuery.
 *
 * These pins are what keeps that from recurring silently. A future edit that
 * deletes one of these resource blocks does not merely change a file — it
 * re-arms a destroy plan against production, and that has to fail a test
 * rather than pass review as a tidy-up.
 *
 * The plan itself is the real proof and it cannot run offline; it is recorded
 * in `docs/verification/2026-09-05-terraform-state-reconciled.md`. What runs
 * here is the shape the plan depended on.
 */
import { parse } from '@cdktf/hcl2json';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const TF_DIR = path.join(process.cwd(), 'infrastructure', 'terraform');
const read = (file: string): string => readFileSync(path.join(TF_DIR, file), 'utf8');

const SERVICES = ['event_stream', 'data_generator', 'sgtm', 'sgtm_preview', 'metabase'];

/* eslint-disable @typescript-eslint/no-explicit-any */
let cloudRun: Record<string, any>;
let datasets: Record<string, any>;
let topics: Record<string, any>;
let subscriptions: Record<string, any>;
/* eslint-enable @typescript-eslint/no-explicit-any */

beforeAll(async () => {
  cloudRun = (await parse('cloud-run.tf', read('cloud-run.tf'))).resource
    .google_cloud_run_v2_service;
  const bq = await parse('bigquery.tf', read('bigquery.tf'));
  datasets = bq.resource.google_bigquery_dataset;
  const ps = await parse('pubsub.tf', read('pubsub.tf'));
  topics = ps.resource.google_pubsub_topic;
  subscriptions = ps.resource.google_pubsub_subscription;
});

describe('13.7 — traffic routing belongs to the deploy scripts, not Terraform', () => {
  it.each(SERVICES)('%s ignores traffic changes', (name) => {
    // `deploy-cloud-run.sh promote` pins traffic to one reviewed revision while
    // this configuration asks for LATEST. Without this exclusion a plan reports
    // drift after every promote, and an apply silently undoes the operator's
    // choice of which revision serves.
    expect(cloudRun[name][0].lifecycle[0].ignore_changes).toContain('${traffic}');
  });

  it('keeps the source-deploy exclusions it already had', () => {
    // Guards against a future edit that rewrites the list to hold only traffic.
    for (const name of SERVICES) {
      expect(cloudRun[name][0].lifecycle[0].ignore_changes).toEqual(
        expect.arrayContaining(['${client}', '${template[0].containers[0].image}']),
      );
    }
  });
});

describe('13.7 — the recovered BigQuery datasets', () => {
  it('declares all four, so none of them plans as a destroy', () => {
    expect(Object.keys(datasets).sort()).toEqual(['assertions', 'marts', 'raw', 'staging']);
  });

  it.each([
    ['raw', 'iampatterson_raw'],
    ['staging', 'iampatterson_staging'],
    ['marts', 'iampatterson_marts'],
    ['assertions', 'iampatterson_assertions'],
  ])('%s addresses the live dataset %s in the US location', (key, datasetId) => {
    expect(datasets[key][0].dataset_id).toBe(datasetId);
    expect(datasets[key][0].location).toBe('US');
  });

  it('never allows a destroy to drop table contents', () => {
    // The provider defaults this to false; setting it true would turn a refused
    // destroy into a silent warehouse deletion. Absent or false, never true.
    for (const key of Object.keys(datasets)) {
      expect(datasets[key][0].delete_contents_on_destroy).toBeFalsy();
    }
  });

  it('records the 60-day expiry that is live on the raw dataset', () => {
    // 13.1 decides whether 60 days is right; this pin only asserts the
    // configuration keeps saying what is actually live until it does.
    expect(datasets.raw[0].default_table_expiration_ms).toBe(5184000000);
    expect(datasets.raw[0].default_partition_expiration_ms).toBe(5184000000);
  });
});

describe('13.7 — the recovered event pipeline transport', () => {
  it('declares the topic and the push subscription', () => {
    expect(topics.events[0].name).toBe('iampatterson-events');
    expect(subscriptions.events_push[0].name).toBe('iampatterson-events-push');
  });

  it('binds the subscription to the topic by reference, not by a literal string', () => {
    // A literal would let the two drift apart under a rename.
    expect(subscriptions.events_push[0].topic).toBe('${google_pubsub_topic.events.id}');
  });

  it('pushes to event-stream on the live endpoint and ack deadline', () => {
    expect(subscriptions.events_push[0].push_config[0].push_endpoint).toBe(
      'https://event-stream-eb4xrwmo3q-uc.a.run.app/pubsub/push',
    );
    expect(subscriptions.events_push[0].ack_deadline_seconds).toBe(30);
    expect(subscriptions.events_push[0].message_retention_duration).toBe('604800s');
  });

  it('has no dead-letter policy, which is the live shape 13.5 has to explain', () => {
    // Recorded rather than quietly fixed: adding one is a design decision, and
    // the runbook's "event pipeline backlog" entry is where its absence lands.
    expect(subscriptions.events_push[0].dead_letter_policy).toBeUndefined();
  });
});
