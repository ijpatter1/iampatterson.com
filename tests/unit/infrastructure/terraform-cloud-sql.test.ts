/**
 * @jest-environment node
 *
 * Phase 11 D9 — Cloud SQL (Metabase app DB) pins.
 */
import { parse } from '@cdktf/hcl2json';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const TF_DIR = path.join(process.cwd(), 'infrastructure', 'terraform');
const read = (file: string): string => readFileSync(path.join(TF_DIR, file), 'utf8');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let tf: any;

beforeAll(async () => {
  tf = await parse('cloud-sql.tf', read('cloud-sql.tf'));
});

describe('Phase 11 D9 — Cloud SQL', () => {
  describe('instance', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let inst: any;
    beforeAll(() => {
      inst = tf.resource.google_sql_database_instance.metabase_app_db[0];
    });

    it('runs Postgres 15 with terraform deletion protection on', () => {
      expect(inst.database_version).toBe('POSTGRES_15');
      expect(inst.deletion_protection).toBe(true);
    });

    it('is private-IP only — no public IPv4 (security boundary)', () => {
      const ip = inst.settings[0].ip_configuration[0];
      expect(ip.ipv4_enabled).toBe(false);
      expect(ip.private_network).toMatch(/global\/networks\/default/);
    });

    it('keeps backups + point-in-time recovery enabled', () => {
      const backup = inst.settings[0].backup_configuration[0];
      expect(backup.enabled).toBe(true);
      expect(backup.point_in_time_recovery_enabled).toBe(true);
    });
  });

  describe('database + user', () => {
    it('declares the metabase database', () => {
      expect(tf.resource.google_sql_database.metabase[0].name).toBe('metabase');
    });

    it('never manages the metabase user password (ignored — lives in Secret Manager)', () => {
      const user = tf.resource.google_sql_user.metabase[0];
      expect(user.name).toBe('metabase');
      expect(user.lifecycle[0].ignore_changes).toContain('${password}');
    });

    it('inlines no database password literal', () => {
      const text = read('cloud-sql.tf');
      expect(text).not.toMatch(/password\s*=\s*"/);
    });
  });
});
