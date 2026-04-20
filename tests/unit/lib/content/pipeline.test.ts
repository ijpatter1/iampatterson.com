/**
 * Pipeline-section content schema tests. The `PIPELINE_STAGES` constant
 * is the spine of the editorial schematic in `PipelineEditorial`, and
 * the values that appear in the rendered readouts (GTM container IDs,
 * sGTM hostname, BQ dataset) are real production values verified against
 * `infrastructure/gtm/web-container.json` and
 * `infrastructure/gtm/server-container.json` — not the prototype's mock
 * fields. Pinning them here so a future schema change doesn't silently
 * drift, and so a fabricated value can't slip past review.
 */

import { PIPELINE_STAGES, type PipelineStage } from '@/lib/content/pipeline';

describe('PIPELINE_STAGES', () => {
  it('declares exactly five stages in browser → dashboards order', () => {
    expect(PIPELINE_STAGES).toHaveLength(5);
    expect(PIPELINE_STAGES.map((s) => s.key)).toEqual(['browser', 'cgtm', 'sgtm', 'bq', 'dash']);
  });

  it('numbers stages 01..05 in display order', () => {
    expect(PIPELINE_STAGES.map((s) => s.n)).toEqual(['01', '02', '03', '04', '05']);
  });

  it('each stage carries title, role, tech, sub, and reads[]', () => {
    PIPELINE_STAGES.forEach((stage: PipelineStage) => {
      expect(stage.title.length).toBeGreaterThan(0);
      expect(stage.role.length).toBeGreaterThan(0);
      expect(stage.tech.length).toBeGreaterThan(0);
      expect(stage.sub.length).toBeGreaterThan(0);
      expect(stage.reads.length).toBeGreaterThanOrEqual(2);
      stage.reads.forEach((r) => {
        expect(r.k.length).toBeGreaterThan(0);
        expect(r.v.length).toBeGreaterThan(0);
      });
    });
  });

  it('uses the real web GTM container ID (GTM-MWHFMTZN) for browser + cgtm stages', () => {
    // Pinning value verified against infrastructure/gtm/web-container.json
    // and process.env.NEXT_PUBLIC_GTM_ID. Fabricating this would let a
    // marketing-ops reader catch the section in a lie on the very surface
    // whose copy says "the events aren't simulated. The warehouse is real."
    const browser = PIPELINE_STAGES.find((s) => s.key === 'browser');
    const cgtm = PIPELINE_STAGES.find((s) => s.key === 'cgtm');
    expect(browser?.tech).toBe('GTM-MWHFMTZN');
    expect(cgtm?.tech).toBe('GTM-MWHFMTZN');
  });

  it('uses the real server GTM container ID (GTM-NTTKZFWD) on the sgtm stage', () => {
    // Pinning value verified against infrastructure/gtm/server-container.json.
    const sgtm = PIPELINE_STAGES.find((s) => s.key === 'sgtm');
    expect(sgtm?.tech).toBe('GTM-NTTKZFWD');
  });

  it('surfaces the real sGTM hostname (io.iampatterson.com) on the sgtm stage readouts', () => {
    const sgtm = PIPELINE_STAGES.find((s) => s.key === 'sgtm');
    const hostRead = sgtm?.reads.find((r) => r.k === 'host');
    expect(hostRead?.v).toBe('io.iampatterson.com');
  });

  it('uses the real BigQuery raw events table (iampatterson_raw.events_raw)', () => {
    const bq = PIPELINE_STAGES.find((s) => s.key === 'bq');
    // The tech line should reference the real raw dataset; specific cell
    // values may vary but the dataset.table identity must be honest.
    expect(bq?.tech.toLowerCase()).toContain('iampatterson_raw');
    expect(bq?.tech.toLowerCase()).toContain('events_raw');
  });

  it('readout keys are stable mono-readout labels (snake_case)', () => {
    const allKeys = PIPELINE_STAGES.flatMap((s) => s.reads.map((r) => r.k));
    allKeys.forEach((k) => {
      expect(k).toMatch(/^[a-z][a-z0-9_]*$/);
    });
  });

  it('keys are unique across the stages list', () => {
    const keys = PIPELINE_STAGES.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
