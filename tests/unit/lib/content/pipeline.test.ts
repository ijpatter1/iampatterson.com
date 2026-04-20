/**
 * Pipeline-section content schema tests (F6 UAT close-out rewrite).
 *
 * Pre-F6 the schema carried dense instrument-panel metadata (`tech`,
 * `sub`, `reads[]`) with real production identifiers. F6 cut that
 * metadata in favor of an editorial `detail` one-liner — the
 * instrument-panel surface lives in the overlay now (Timeline event-
 * detail, Consent tab, Overview tab), where the density fits the
 * CRT/terminal aesthetic. The pipeline section reads as editorial prose.
 *
 * Remaining identifier anchors kept in the detail copy (e.g.
 * `iampatterson_raw.events_raw` in Stage 04) are pinned here so a
 * future copy edit doesn't silently drop the load-bearing anchor.
 */

import { PIPELINE_STAGES, type PipelineStage } from '@/lib/content/pipeline';

describe('PIPELINE_STAGES (F6 editorial rewrite)', () => {
  it('declares exactly five stages in browser → dashboards order', () => {
    expect(PIPELINE_STAGES).toHaveLength(5);
    expect(PIPELINE_STAGES.map((s) => s.key)).toEqual(['browser', 'cgtm', 'sgtm', 'bq', 'dash']);
  });

  it('numbers stages 01..05 in display order', () => {
    expect(PIPELINE_STAGES.map((s) => s.n)).toEqual(['01', '02', '03', '04', '05']);
  });

  it('each stage carries title, role, and detail (instrument-panel fields dropped)', () => {
    PIPELINE_STAGES.forEach((stage: PipelineStage) => {
      expect(stage.title.length).toBeGreaterThan(0);
      expect(stage.role.length).toBeGreaterThan(0);
      expect(stage.detail.length).toBeGreaterThan(0);
    });
    // The legacy instrument-panel fields (`tech`, `sub`, `reads`) are
    // gone — assert via index-type narrowing that the current schema
    // doesn't carry them. A test that simply reads `.tech` would
    // compile-fail under strict mode; pin the intent via hasOwn.
    const keys = Object.keys(PIPELINE_STAGES[0]);
    expect(keys).not.toContain('tech');
    expect(keys).not.toContain('sub');
    expect(keys).not.toContain('reads');
  });

  it('pins iampatterson_raw.events_raw as the load-bearing BigQuery anchor (Stage 04)', () => {
    // The detail copy references the real dataset.table by name — that
    // specific identifier is the "events land in a real warehouse" proof
    // and must not silently drift or vanish in copy edits.
    const bq = PIPELINE_STAGES.find((s) => s.key === 'bq');
    expect(bq?.detail).toMatch(/iampatterson_raw\.events_raw/);
  });

  it('keys are unique across the stages list', () => {
    const keys = PIPELINE_STAGES.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('detail copy stays short-form prose (≤ 200 chars per stage)', () => {
    // Editorial one-liner constraint — a regression that adds dense
    // paragraphs would degrade the "pipeline reads as editorial" signal
    // that this rewrite is meant to restore. Not exact; just a cap.
    PIPELINE_STAGES.forEach((stage) => {
      expect(stage.detail.length).toBeLessThanOrEqual(200);
    });
  });
});
