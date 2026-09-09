/**
 * The client's consent-exemption set must match the GTM container's.
 *
 * `buildRouting` predicts, client-side, which destinations an event reached.
 * That prediction is only honest if it knows which tags the container fires
 * regardless of consent — `GA4 - consent_update` carries "No consent
 * requirement — consent_update must fire regardless of consent state to track
 * the consent change itself", and every other GA4 tag requires
 * `analytics_storage`.
 *
 * Without this pin, a review found the failure mode directly: pinning a
 * declining visitor's timeline to the data layer marked EVERY destination
 * `blocked_consent`, including on the one event that genuinely was delivered
 * and is queryable in BigQuery. Under-reporting was traded for over-reporting
 * on the single row whose routing was real.
 *
 * This is the phase's own thesis applied to a client-side assumption: two
 * committed artifacts that must agree, with something comparing them.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { CONSENT_EXEMPT_EVENTS } from '@/hooks/useDataLayerEvents';

interface ContainerTag {
  name: string;
  type?: string;
  /** The GA4 event name, a TOP-LEVEL key on the tag — not under `parameters`. */
  eventName?: string;
  consentRequired?: Record<string, unknown> | null;
  consentSettings?: Record<string, unknown> | null;
}

const container = JSON.parse(
  readFileSync(path.join(process.cwd(), 'infrastructure', 'gtm', 'web-container.json'), 'utf8'),
) as { tags: ContainerTag[] };

/** GA4 event tags the container fires with no analytics_storage requirement. */
function exemptEventNames(): string[] {
  return container.tags
    .filter((t) => {
      const consent = t.consentRequired ?? t.consentSettings ?? null;
      const requiresAnalytics =
        consent !== null && Object.prototype.hasOwnProperty.call(consent, 'analytics_storage');
      // A tag with no analytics_storage key fires regardless of consent.
      return !requiresAnalytics;
    })
    .map((t) => t.eventName ?? '')
    .filter((n) => n.length > 0);
}

describe('the client knows which tags the container exempts from consent', () => {
  it('finds tags in the container, so an empty parse is not a silent pass', () => {
    expect(Array.isArray(container.tags)).toBe(true);
    expect(container.tags.length).toBeGreaterThan(10);
  });

  it('every event the container fires regardless of consent is in CONSENT_EXEMPT_EVENTS', () => {
    for (const name of exemptEventNames()) {
      expect([...CONSENT_EXEMPT_EVENTS]).toContain(name);
    }
  });

  it('and the set claims nothing the container does not actually exempt', () => {
    const containerExempt = new Set(exemptEventNames());
    for (const claimed of CONSENT_EXEMPT_EVENTS) {
      expect([...containerExempt]).toContain(claimed);
    }
  });

  it('consent_update specifically, since the whole routing prediction hangs on it', () => {
    expect(CONSENT_EXEMPT_EVENTS.has('consent_update')).toBe(true);
    expect(exemptEventNames()).toContain('consent_update');
  });
});
