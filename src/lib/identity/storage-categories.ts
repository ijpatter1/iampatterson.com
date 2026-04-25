export type StorageSource = 'cookie' | 'localStorage' | 'sessionStorage';

export type StorageCategoryId =
  | 'app-identity'
  | 'analytics'
  | 'consent'
  | 'third-party'
  | 'uncategorized';

interface CategoryDef {
  readonly id: StorageCategoryId;
  readonly label: string;
  readonly description: string;
}

export const STORAGE_CATEGORIES: readonly CategoryDef[] = [
  {
    id: 'app-identity',
    label: 'app identity',
    description: 'first-party keys this site mints to identify the visitor or session',
  },
  {
    id: 'analytics',
    label: 'analytics',
    description: 'first-party measurement cookies set by GA4, sGTM, and Google Ads',
  },
  {
    id: 'consent',
    label: 'consent',
    description: "Cookiebot's consent state",
  },
  {
    id: 'third-party',
    label: 'third-party',
    description: 'tracker keys placed by non-first-party tags. Empty when consent is denied.',
  },
  {
    id: 'uncategorized',
    label: 'uncategorized',
    description: 'no classification rule matched these',
  },
] as const;

interface ClassifierRule {
  readonly category: Exclude<StorageCategoryId, 'uncategorized'>;
  readonly match: RegExp;
}

const RULES: readonly ClassifierRule[] = [
  // First-party app identity. _iap_aid (D7) + _iap_sid (Phase 2) + iampatterson.* namespace.
  { category: 'app-identity', match: /^_iap_aid$/ },
  { category: 'app-identity', match: /^_iap_sid$/ },
  { category: 'app-identity', match: /^iampatterson\./ },

  // First-party analytics. GA4, legacy GA, sGTM first-party id/linker, Google Ads conversion linker.
  { category: 'analytics', match: /^_ga$/ },
  { category: 'analytics', match: /^_ga_/ },
  { category: 'analytics', match: /^_gid$/ },
  { category: 'analytics', match: /^FPID$/ },
  { category: 'analytics', match: /^FPLC$/ },
  { category: 'analytics', match: /^_gcl_/ },

  // CMP. Cookiebot.
  { category: 'consent', match: /^CookieConsent$/ },
  { category: 'consent', match: /^CookieConsentBulkSetting/ },
  { category: 'consent', match: /^CookieConsentBulkTicket$/ },

  // Third-party trackers — recognized names commonly placed by non-first-party tags.
  // Empty in this site's current setup; included so future tag additions surface honestly.
  { category: 'third-party', match: /^_fbp$/ },
  { category: 'third-party', match: /^_fbc$/ },
  { category: 'third-party', match: /^_uetsid$/ },
  { category: 'third-party', match: /^_uetvid$/ },
  { category: 'third-party', match: /^_pin_unauth$/ },
  { category: 'third-party', match: /^MUID$/ },
  { category: 'third-party', match: /^IDE$/ },
  { category: 'third-party', match: /^personalization_id$/ },
];

export function categorizeKey(name: string, _source: StorageSource): StorageCategoryId {
  for (const rule of RULES) {
    if (rule.match.test(name)) return rule.category;
  }
  return 'uncategorized';
}
