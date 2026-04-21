/**
 * Timeline ring-buffer persistence — ensures Timeline survives page
 * refresh (F8 user-reported regression pin).
 */
import {
  TIMELINE_BUFFER_STORAGE_KEY,
  loadTimelineBuffer,
  saveTimelineBuffer,
} from '@/lib/events/timeline-buffer';
import type { PipelineEvent } from '@/lib/events/pipeline-schema';

function event(id: string): PipelineEvent {
  return {
    pipeline_id: id,
    received_at: '2026-04-21T00:00:01.000Z',
    session_id: 'sid-xyz',
    event_name: 'page_view',
    timestamp: '2026-04-21T00:00:00.000Z',
    page_path: '/',
    page_title: '',
    page_location: 'http://localhost/',
    parameters: {},
    consent: {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      functionality_storage: 'granted',
    },
    routing: [],
  };
}

describe('timeline-buffer', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('round-trips a bounded event array through sessionStorage', () => {
    const events: PipelineEvent[] = [event('a'), event('b'), event('c')];
    saveTimelineBuffer(events);
    expect(loadTimelineBuffer().map((e) => e.pipeline_id)).toEqual(['a', 'b', 'c']);
  });

  it('returns [] when the key is unset (fresh session)', () => {
    expect(loadTimelineBuffer()).toEqual([]);
  });

  it('caps the persisted window at 100 events', () => {
    const events: PipelineEvent[] = Array.from({ length: 250 }, (_, i) => event(`e-${i}`));
    saveTimelineBuffer(events);
    const raw = window.sessionStorage.getItem(TIMELINE_BUFFER_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed: PipelineEvent[] = JSON.parse(raw!);
    expect(parsed).toHaveLength(100);
    expect(parsed[0].pipeline_id).toBe('e-0');
  });

  it('tolerates sessionStorage throwing on setItem (quota / strict-privacy)', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    try {
      expect(() => saveTimelineBuffer([event('q')])).not.toThrow();
    } finally {
      Storage.prototype.setItem = original;
    }
  });

  it('drops structurally-invalid entries on load (defensive against schema drift)', () => {
    window.sessionStorage.setItem(
      TIMELINE_BUFFER_STORAGE_KEY,
      JSON.stringify([
        event('ok'),
        { pipeline_id: 'bad', timestamp: 'x' }, // missing required fields
        null,
        'not-an-object',
      ]),
    );
    const loaded = loadTimelineBuffer();
    expect(loaded.map((e) => e.pipeline_id)).toEqual(['ok']);
  });
});
