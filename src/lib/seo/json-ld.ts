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

const SITE_URL = 'https://iampatterson.com';
const ORG_NAME = 'Patterson Consulting';
const PERSON_NAME = 'Ian Patterson';

export function organizationJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: ORG_NAME,
    url: SITE_URL,
    description:
      'Measurement infrastructure for marketing teams. The site itself runs on the same stack I sell.',
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
    jobTitle: 'Measurement Infrastructure Consultant',
    worksFor: {
      '@type': 'Organization',
      name: ORG_NAME,
      url: SITE_URL,
    },
    knowsAbout: [
      'Marketing measurement infrastructure',
      'Server-side tagging (sGTM)',
      'BigQuery data warehouse',
      'Dataform',
      'Google Analytics 4',
      'Consent Mode v2 and Cookiebot',
      'Metabase BI',
      'Marketing attribution modeling',
    ],
  };
}
