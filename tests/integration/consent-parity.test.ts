/**
 * Consent parity: what the container requires vs. what the bridge grants.
 *
 * A Phase 11 carry-forward, kept deliberately in [14.1] because the reconciler
 * now owns `consentSettings` on every tag and the pin is cheap while that code
 * is open.
 *
 * What this does NOT catch, stated because it would be easy to assume
 * otherwise: the divergence the 2026-09-08 census found by hand — the spec
 * declaring `analytics_storage: required` since Phase 1 while the live
 * container carried `notNeeded` for eight months — is spec-versus-CONTAINER
 * drift, and the reconciler's dry run is what detects that. This file compares
 * the spec to the application code, which is a different seam.
 *
 * The failure this guards is silent in both directions:
 *
 *   A tag requiring a signal the bridge never sends can never fire. Consent
 *   Mode defaults everything to denied, so the tag waits for an update that
 *   does not come — no error, no log, just an event that stops arriving.
 *
 *   A signal the bridge sends that no tag requires is not a fault, but it is
 *   worth seeing: it usually means a gate was intended and never applied,
 *   which is exactly the state this container was in.
 */
import * as fs from 'fs';
import * as path from 'path';

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, p), 'utf-8');

const webContainer = JSON.parse(read('../../infrastructure/gtm/web-container.json'));
const trackSource = read('../../src/lib/events/track.ts');

/** The signals `bridgeToGtagConsent` actually passes to gtag('consent','update'). */
function bridgedSignals(): string[] {
  const body = trackSource.match(/gtag\('consent', 'update', \{([\s\S]*?)\}\);/)?.[1] ?? '';
  return [...body.matchAll(/^\s*([a-z_]+):/gm)].map((m) => m[1]);
}

/** Every consent signal any tag in the committed spec requires. */
function requiredSignals(): string[] {
  const out = new Set<string>();
  for (const tag of webContainer.tags) {
    for (const [signal, value] of Object.entries(tag.consentSettings ?? {})) {
      if (signal !== 'note' && value === 'required') out.add(signal);
    }
  }
  return [...out];
}

describe('consent parity between the container and the gtag bridge', () => {
  it('bridges every signal the container requires', () => {
    // The silent killer: a required signal the bridge never grants leaves the
    // tag waiting on Consent Mode's denied default forever.
    const bridged = bridgedSignals();
    for (const signal of requiredSignals()) {
      expect(bridged).toContain(signal);
    }
  });

  it('finds the bridge at all, so a rename cannot make this vacuous', () => {
    // Without this, refactoring bridgeToGtagConsent's call shape would leave
    // bridgedSignals() returning [] and every assertion above passing.
    expect(bridgedSignals().length).toBeGreaterThanOrEqual(5);
    expect(bridgedSignals()).toContain('analytics_storage');
  });

  it('requires analytics_storage on every GA4 tag but the consent recorder', () => {
    // Published 2026-09-08 as version 9. GA4 - consent_update is deliberately
    // exempt: it is how a decliner's choice reaches the pipeline at all, and
    // gating it would mean the overlay could never show them their own
    // decision being honoured.
    const ga4Tags = webContainer.tags.filter((t: { type: string }) => t.type.includes('gaawe'));
    for (const tag of ga4Tags) {
      const required = Object.entries(tag.consentSettings ?? {})
        .filter(([k, v]) => k !== 'note' && v === 'required')
        .map(([k]) => k);
      if (tag.name === 'GA4 - consent_update') {
        expect(required).toEqual([]);
      } else {
        expect(required).toContain('analytics_storage');
      }
    }
  });

  it('records which bridged signals no tag gates on', () => {
    // Not a failure — marketing signals are bridged for Consent Mode's own
    // use. Asserting the exact set means adding a gate, or removing one,
    // shows up here as a decision rather than a silent drift.
    const unused = bridgedSignals().filter((s) => !requiredSignals().includes(s));
    expect(unused.sort()).toEqual([
      'ad_personalization',
      'ad_storage',
      'ad_user_data',
      'functionality_storage',
      'personalization_storage',
    ]);
  });
});
