/**
 * Phase 10d D4 — JSON-LD structured data.
 *
 * Two builders: `organizationJsonLd()` and `personJsonLd()`. Each
 * returns a plain JSON-serializable object that callers `JSON.stringify`
 * into a `<script type="application/ld+json">` tag.
 *
 * Schema.org references:
 *   - https://schema.org/Organization
 *   - https://schema.org/Person
 *
 * Both schemas point at `https://iampatterson.com` as the canonical
 * URL. The Person schema is `worksFor` linked to the Organization so
 * Google's Knowledge Graph can resolve the consultant ↔ entity
 * relationship cleanly.
 */

import { SITE_DESCRIPTION } from './site';

const SITE_URL = 'https://iampatterson.com';
const ORG_NAME = 'I am Patterson';
const PERSON_NAME = 'Ian Patterson';

export function organizationJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: ORG_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    founder: {
      '@type': 'Person',
      name: PERSON_NAME,
      url: SITE_URL,
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: 'ian@iampatterson.com',
      availableLanguage: ['English'],
    },
  };
}

export function personJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: PERSON_NAME,
    url: SITE_URL,
    jobTitle: 'Founder, I am Patterson',
    worksFor: {
      '@type': 'Organization',
      name: ORG_NAME,
      url: SITE_URL,
    },
    // The LinkedIn profile's pinned skills, then the stack it names.
    knowsAbout: [
      'Marketing analytics',
      'Analytics engineering',
      'AI implementation',
      'BigQuery',
      'Marketing measurement',
      'Server-side tagging (sGTM)',
      'Conversions APIs',
      'Google Analytics 4',
      'Consent Mode v2, Cookiebot and OneTrust',
      'Dataform',
    ],
  };
}
