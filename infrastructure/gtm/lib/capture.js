/**
 * Merge a live read back into a committed container spec.
 *
 * The brownfield direction: for a spec that never described its container, the
 * container is the truth and the file moves to it. But two things live in the
 * file that the API cannot give back, and rebuilding the file from scratch
 * deletes both.
 *
 *   `note` fields carry the *why* — including the GA4 - Config note recording
 *   that `page_location` must never be set in configSettings, which exists
 *   because setting it caused a site-wide attribution regression. There is no
 *   API field to round-trip prose through, so a capture that does not preserve
 *   notes destroys the only record of intent the spec has.
 *
 *   Unowned collections — `clients` in the server spec, and anything else the
 *   reconciler does not manage. The diff already treats these as outside its
 *   ownership: "neither drift nor deletion candidates". Deleting them from
 *   disk would contradict that on the one path that writes to disk.
 *
 * Entities absent from the live read are dropped, which is what a capture
 * means. Collections absent from the live read are untouched, which is what
 * ownership means.
 */

/** Notes from the existing file, keyed by entity name, per collection. */
function notesByName(entities) {
  const out = new Map();
  for (const e of entities || []) if (e && e.note) out.set(e.name, e.note);
  return out;
}

function mergeCaptured(existing, captured) {
  const merged = { ...existing };

  merged._meta = {
    ...(existing._meta || {}),
    capturedAt: new Date().toISOString().slice(0, 10),
    capturedNote:
      'Regenerated from the live Default Workspace. This file describes what is live; edit it to change the container, then apply. Prose notes are preserved across a capture; everything else comes from the container.',
  };

  for (const [collection, entities] of Object.entries(captured)) {
    const keep = notesByName(existing[collection]);
    merged[collection] = entities.map((e) => {
      const note = keep.get(e.name);
      return note ? { ...e, note } : { ...e };
    });
  }

  return merged;
}

module.exports = { mergeCaptured };
