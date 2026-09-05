/**
 * Cloud Run runtime identity and scaling (Phase 13, 13.4).
 *
 * Four services ran as the default compute service account, which holds
 * roles/editor on the project. These pins hold the corrected state in the
 * declared configuration, so a regression has to fail a test rather than pass
 * review as a formatting change.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');

const cloudRun = read('infrastructure/terraform/cloud-run.tf');
const accounts = read('infrastructure/terraform/service-accounts.tf');
const services = read('infrastructure/terraform/project-services.tf');

const DEFAULT_COMPUTE = '262727068689-compute@developer.gserviceaccount.com';

/** The body of one `google_cloud_run_v2_service` block. */
const block = (name: string): string => {
  const re = new RegExp(`resource "google_cloud_run_v2_service" "${name}" \\{([\\s\\S]*?)\\n\\}`, 'm');
  const m = re.exec(cloudRun);
  if (!m) throw new Error(`no resource block for ${name}`);
  return m[1];
};

describe('13.4 — no service runs as the default compute account', () => {
  it('the default compute account appears nowhere as a runtime identity', () => {
    // It holds roles/editor. Four services used to run as it.
    const identityLines = cloudRun
      .split('\n')
      .filter((l) => /^\s*service_account\s+=/.test(l))
      .filter((l) => l.includes(DEFAULT_COMPUTE));
    expect(identityLines).toEqual([]);
  });

  it.each([
    ['sgtm', 'sgtm-runtime'],
    ['sgtm_preview', 'sgtm-preview-runtime'],
    ['event_stream', 'event-stream-runtime'],
    ['data_generator', 'data-gen-runtime'],
  ])('%s declares the dedicated account %s', (resource, sa) => {
    expect(block(resource)).toContain(`${sa}@iampatterson.iam.gserviceaccount.com`);
  });
});

describe('13.4 — the corrected scaling', () => {
  it('sgtm carries the raised ceiling, not the one that was aborting requests', () => {
    // 96 `no available instance` aborts in the 30 days to 2026-09-05 at max 3.
    // maxScale is a ceiling, not a reservation, so raising it costs nothing idle.
    expect(block('sgtm')).toMatch(/max_instance_count\s*=\s*10\b/);
    expect(block('sgtm')).not.toMatch(/max_instance_count\s*=\s*3\b/);
  });

  it('data-generator is deliberately left alone', () => {
    // One abort in 30 days, on a weekday demo generator whose next run succeeds
    // twenty minutes later. Minimum instances would cost more than the fault.
    expect(block('data_generator')).toMatch(/min_instance_count\s*=\s*0\b/);
  });
});

describe('13.4 — the accounts are declared, not just created', () => {
  it.each([
    'claudish_proxy',
    'sgtm_runtime',
    'sgtm_preview_runtime',
    'event_stream_runtime',
    'data_gen_runtime',
  ])('service-accounts.tf declares %s so the import block adopts it', (key) => {
    expect(accounts).toMatch(new RegExp(`\\n\\s{4}${key} = \\{`));
  });

  it('project-services.tf declares aiplatform, the spec-delta IMPORT_PLAN predicted', () => {
    // Live-enabled since the BigQuery Vertex connection, absent from the curated
    // list. Import, do not create.
    expect(services).toContain('"aiplatform.googleapis.com"');
  });
});
