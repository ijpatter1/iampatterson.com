/**
 * Capture merges into the committed spec (Phase 14, alignment review finding 5).
 *
 * `--capture` writes live back into a spec that never described its container —
 * the brownfield direction [14.1] takes with the server container. It was
 * rebuilding the file as `{ _meta, variables, triggers, tags }`, which deletes
 * two things the API cannot give back:
 *
 *   `note` fields. Thirteen in the web spec, ten in the server spec, including
 *   the GA4 - Config note recording why `page_location` must never be set in
 *   configSettings — a site-wide attribution regression caught by adversarial
 *   review. The API has no field to round-trip prose through.
 *
 *   Unowned collections. `server-container.json` has a top-level `clients`
 *   array the census identifies as the one thing that spec got right. The
 *   reconciler declares built-in variables, folders, templates and clients
 *   outside its ownership; deleting them from disk contradicts that on the one
 *   path that writes to disk.
 */
import { mergeCaptured } from '../../../infrastructure/gtm/lib/capture.js';

const existing = {
  _meta: { containerId: 'GTM-NTTKZFWD', note: 'hand-written intent' },
  clients: [{ name: 'GA4 client', note: 'the one thing this spec got right' }],
  variables: [{ name: 'dlv - a', type: 'dataLayer', dataLayerVariable: 'a', note: 'why a exists' }],
  triggers: [{ name: 'ce - a', type: 'customEvent', eventName: 'a', note: 'why a fires' }],
  tags: [{ name: 'GA4 - a', type: 'gaawe', note: 'NEVER set page_location here' }],
};

const captured = {
  variables: [
    { name: 'dlv - a', type: 'dataLayer', dataLayerVariable: 'a' },
    { name: 'dlv - new', type: 'dataLayer', dataLayerVariable: 'new' },
  ],
  triggers: [{ name: 'ce - a', type: 'customEvent', eventName: 'a-changed' }],
  tags: [{ name: 'GA4 - a', type: 'gaawe', eventName: 'a' }],
};

describe('mergeCaptured', () => {
  const merged = mergeCaptured(existing, captured);

  it('keeps the note on an entity that still exists live', () => {
    expect(merged.tags[0].note).toBe('NEVER set page_location here');
    expect(merged.variables.find((v: { name: string }) => v.name === 'dlv - a').note).toBe(
      'why a exists',
    );
  });

  it('takes live as the truth for everything else on that entity', () => {
    // The whole point of a capture: the spec was wrong about the container.
    expect(merged.triggers[0].eventName).toBe('a-changed');
    expect(merged.triggers[0].note).toBe('why a fires');
  });

  it('carries a newly discovered entity through with no note to keep', () => {
    const fresh = merged.variables.find((v: { name: string }) => v.name === 'dlv - new');
    expect(fresh).toMatchObject({ type: 'dataLayer', dataLayerVariable: 'new' });
    expect(fresh).not.toHaveProperty('note');
  });

  it('preserves a top-level collection the reconciler does not own', () => {
    expect(merged.clients).toEqual(existing.clients);
  });

  it('preserves _meta, and records that the file was captured', () => {
    expect(merged._meta.containerId).toBe('GTM-NTTKZFWD');
    expect(merged._meta.capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('drops an entity that is no longer live, which is what a capture means', () => {
    const gone = mergeCaptured(existing, { variables: [], triggers: [], tags: [] });
    expect(gone.tags).toEqual([]);
    // …but never a collection it did not read.
    expect(gone.clients).toEqual(existing.clients);
  });

  it('does not mutate the file it was given', () => {
    const before = JSON.stringify(existing);
    mergeCaptured(existing, captured);
    expect(JSON.stringify(existing)).toBe(before);
  });
});
